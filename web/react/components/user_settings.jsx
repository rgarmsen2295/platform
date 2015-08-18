// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');
var SettingPicture = require('./setting_picture.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');
var assign = require('object-assign');

function getNotificationsStateFromStores() {
    var user = UserStore.getCurrentUser();
    var soundNeeded = !utils.isBrowserFirefox();

    var sound = 'true';
    if (user.notify_props && user.notify_props.desktop_sound) {
        sound = user.notify_props.desktop_sound;
    }

    var desktop = 'all';
    if (user.notify_props && user.notify_props.desktop) {
        desktop = user.notify_props.desktop;
    }

    var email = 'true';
    if (user.notify_props && user.notify_props.email) {
        email = user.notify_props.email;
    }

    var usernameKey = false;
    var mentionKey = false;
    var customKeys = '';
    var firstNameKey = false;
    var allKey = false;
    var channelKey = false;

    if (user.notify_props) {
        if (user.notify_props.mention_keys) {
            var keys = user.notify_props.mention_keys.split(',');

            if (keys.indexOf(user.username) !== -1) {
                usernameKey = true;
                keys.splice(keys.indexOf(user.username), 1);
            } else {
                usernameKey = false;
            }

            if (keys.indexOf('@' + user.username) !== -1) {
                mentionKey = true;
                keys.splice(keys.indexOf('@' + user.username), 1);
            } else {
                mentionKey = false;
            }

            customKeys = keys.join(',');
        }

        if (user.notify_props.first_name) {
            firstNameKey = user.notify_props.first_name === 'true';
        }

        if (user.notify_props.all) {
            allKey = user.notify_props.all === 'true';
        }

        if (user.notify_props.channel) {
            channelKey = user.notify_props.channel === 'true';
        }
    }

    return {notifyLevel: desktop, enableEmail: email, soundNeeded: soundNeeded, enableSound: sound, usernameKey: usernameKey, mentionKey: mentionKey, customKeys: customKeys, customKeysChecked: customKeys.length > 0, firstNameKey: firstNameKey, allKey: allKey, channelKey: channelKey};
}

var NotificationsTab = React.createClass({
    displayName: 'UserSettingsNotificationsTab',
    propTypes: {
        user: React.PropTypes.object,
        updateSection: React.PropTypes.func,
        updateTab: React.PropTypes.func,
        activeSection: React.PropTypes.string
    },
    handleSubmit: function() {
        var data = {};
        data.user_id = this.props.user.id;
        data.email = this.state.enableEmail;
        data.desktop_sound = this.state.enableSound;
        data.desktop = this.state.notifyLevel;

        var mentionKeys = [];
        if (this.state.usernameKey) {
            mentionKeys.push(this.props.user.username);
        }
        if (this.state.mentionKey) {
            mentionKeys.push('@' + this.props.user.username);
        }

        var stringKeys = mentionKeys.join(',');
        if (this.state.customKeys.length > 0 && this.state.customKeysChecked) {
            stringKeys += ',' + this.state.customKeys;
        }

        data.mention_keys = stringKeys;

        data.first_name = 'false';
        if (this.state.firstNameKey) {
            data.first_name = 'true';
        }

        data.all = 'false';
        if (this.state.allKey) {
            data.all = 'true';
        }

        data.channel = 'false';
        if (this.state.channelKey) {
            data.channel = 'true';
        }

        client.updateUserNotifyProps(data,
            function success() {
                this.props.updateSection('');
                AsyncClient.getMe();
            }.bind(this),
            function error(err) {
                this.setState({serverError: err.message});
            }.bind(this)
        );
    },
    handleClose: function() {
        $(this.getDOMNode()).find('.form-control').each(function clearForms() {
            this.value = '';
        });

        this.setState(assign({}, getNotificationsStateFromStores(), {serverError: null}));

        this.props.updateTab('general');
    },
    componentDidMount: function() {
        UserStore.addChangeListener(this.onListenerChange);
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    },
    componentWillUnmount: function() {
        UserStore.removeChangeListener(this.onListenerChange);
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
        this.props.updateSection('');
    },
    onListenerChange: function() {
        var newState = getNotificationsStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    },
    getInitialState: function() {
        return getNotificationsStateFromStores();
    },
    handleNotifyRadio: function(notifyLevel) {
        this.setState({notifyLevel: notifyLevel});
        this.refs.wrapper.getDOMNode().focus();
    },
    handleEmailRadio: function(enableEmail) {
        this.setState({enableEmail: enableEmail});
        this.refs.wrapper.getDOMNode().focus();
    },
    handleSoundRadio: function(enableSound) {
        this.setState({enableSound: enableSound});
        this.refs.wrapper.getDOMNode().focus();
    },
    updateUsernameKey: function(val) {
        this.setState({usernameKey: val});
    },
    updateMentionKey: function(val) {
        this.setState({mentionKey: val});
    },
    updateFirstNameKey: function(val) {
        this.setState({firstNameKey: val});
    },
    updateAllKey: function(val) {
        this.setState({allKey: val});
    },
    updateChannelKey: function(val) {
        this.setState({channelKey: val});
    },
    updateCustomMentionKeys: function() {
        var checked = this.refs.customcheck.getDOMNode().checked;

        if (checked) {
            var text = this.refs.custommentions.getDOMNode().value;

            // remove all spaces and split string into individual keys
            this.setState({customKeys: text.replace(/ /g, ''), customKeysChecked: true});
        } else {
            this.setState({customKeys: '', customKeysChecked: false});
        }
    },
    onCustomChange: function() {
        this.refs.customcheck.getDOMNode().checked = true;
        this.updateCustomMentionKeys();
    },
    render: function() {
        var serverError = null;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        var self = this;
        var user = this.props.user;

        var desktopSection;
        var handleUpdateDesktopSection;
        var describeDesktop = '';
        var inputs = [];
        if (this.props.activeSection === 'desktop') {
            var notifyActive = [false, false, false];
            if (this.state.notifyLevel === 'mention') {
                notifyActive[1] = true;
            } else if (this.state.notifyLevel === 'none') {
                notifyActive[2] = true;
            } else {
                notifyActive[0] = true;
            }

            inputs.push(
                <div>
                    <div className='radio'>
                        <label>
                            <input type='radio' checked={notifyActive[0]} onChange={self.handleNotifyRadio.bind(this, 'all')}>For all activity</input>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input type='radio' checked={notifyActive[1]} onChange={self.handleNotifyRadio.bind(this, 'mention')}>Only for mentions and private messages</input>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input type='radio' checked={notifyActive[2]} onChange={self.handleNotifyRadio.bind(this, 'none')}>Never</input>
                        </label>
                    </div>
                </div>
            );

            handleUpdateDesktopSection = function updateDesktopSection(e) {
                self.props.updateSection('');
                e.preventDefault();
            };

            desktopSection = (
                <SettingItemMax
                    title='Send desktop notifications'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={handleUpdateDesktopSection}
                />
            );
        } else {
            if (this.state.notifyLevel === 'mention') {
                describeDesktop = 'Only for mentions and private messages';
            } else if (this.state.notifyLevel === 'none') {
                describeDesktop = 'Never';
            } else {
                describeDesktop = 'For all activity';
            }

            handleUpdateDesktopSection = function updateDesktopSection() {
                self.props.updateSection('desktop');
            };

            desktopSection = (
                <SettingItemMin
                    title='Send desktop notifications'
                    describe={describeDesktop}
                    updateSection={handleUpdateDesktopSection}
                />
            );
        }

        var soundSection;
        var handleUpdateSoundSection;
        var describeSound = '';
        if (this.props.activeSection === 'sound' && this.state.soundNeeded) {
            var soundActive = ['', ''];
            if (this.state.enableSound === 'false') {
                soundActive[1] = 'active';
            } else {
                soundActive[0] = 'active';
            }

            inputs = [];

            inputs.push(
                <div>
                    <div className='btn-group' data-toggle='buttons-radio'>
                        <button className={'btn btn-default ' + soundActive[0]} onClick={self.handleSoundRadio.bind(this, 'true')}>On</button>
                        <button className={'btn btn-default ' + soundActive[1]} onClick={self.handleSoundRadio.bind(this, 'false')}>Off</button>
                    </div>
                </div>
            );

            handleUpdateSoundSection = function updateSoundSection(e) {
                self.props.updateSection('');
                e.preventDefault();
            };

            soundSection = (
                <SettingItemMax
                    title='Desktop notification sounds'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={handleUpdateSoundSection}
                />
            );
        } else {
            if (!this.state.soundNeeded) {
                describeSound = 'Please configure notification sounds in your browser settings';
            } else if (this.state.enableSound === 'false') {
                describeSound = 'Off';
            } else {
                describeSound = 'On';
            }

            handleUpdateSoundSection = function updateSoundSection() {
                self.props.updateSection('sound');
            };

            soundSection = (
                <SettingItemMin
                    title='Desktop notification sounds'
                    describe={describeSound}
                    updateSection={handleUpdateSoundSection}
                    disableOpen = {!this.state.soundNeeded}
                />
            );
        }

        var emailSection;
        var handleUpdateEmailSection;
        var describeEmail = '';
        if (this.props.activeSection === 'email') {
            var emailActive = ['', ''];
            if (this.state.enableEmail === 'false') {
                emailActive[1] = 'active';
            } else {
                emailActive[0] = 'active';
            }

            inputs.push(
                <div>
                    <div className='btn-group' data-toggle='buttons-radio'>
                        <button className={'btn btn-default ' + emailActive[0]} onClick={self.handleEmailRadio.bind(this, 'true')}>On</button>
                        <button className={'btn btn-default ' + emailActive[1]} onClick={self.handleEmailRadio.bind(this, 'false')}>Off</button>
                    </div>
                    <div><br/>{'Email notifications are sent for mentions and private messages after you have been away from ' + config.SiteName + ' for 5 minutes.'}</div>
                </div>
            );

            handleUpdateEmailSection = function updateEmailSection(e) {
                self.props.updateSection('');
                e.preventDefault();
            };

            emailSection = (
                <SettingItemMax
                    title='Email notifications'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={handleUpdateEmailSection}
                />
            );
        } else {
            if (this.state.enableEmail === 'false') {
                describeEmail = 'Off';
            } else {
                describeEmail = 'On';
            }

            handleUpdateEmailSection = function updateEmailSection() {
                self.props.updateSection('email');
            };

            emailSection = (
                <SettingItemMin
                    title='Email notifications'
                    describe={describeEmail}
                    updateSection={handleUpdateEmailSection}
                />
            );
        }

        var keysSection;
        var handleUpdateKeysSection;
        var describeKeys = '';
        if (this.props.activeSection === 'keys') {
            var handleUpdateFirstNameKey;
            var handleUpdateUsernameKey;
            var handleUpdateMentionKey;
            var handleUpdateAllKey;
            var handleUpdateChannelKey;

            if (user.first_name) {
                handleUpdateFirstNameKey = function handleFirstNameKeyChange(e) {
                    self.updateFirstNameKey(e.target.checked);
                };

                inputs.push(
                    <div>
                        <div className='checkbox'>
                            <label>
                                <input type='checkbox' checked={this.state.firstNameKey} onChange={handleUpdateFirstNameKey}>{'Your case sensitive first name "' + user.first_name + '"'}</input>
                            </label>
                        </div>
                    </div>
                );
            }

            handleUpdateUsernameKey = function handleUsernameKeyChange(e) {
                self.updateUsernameKey(e.target.checked);
            };
            inputs.push(
                <div>
                    <div className='checkbox'>
                        <label>
                            <input type='checkbox' checked={this.state.usernameKey} onChange={handleUpdateUsernameKey}>{'Your non-case sensitive username "' + user.username + '"'}</input>
                        </label>
                    </div>
                </div>
            );

            handleUpdateMentionKey = function handleMentionKeyChange(e) {
                self.updateMentionKey(e.target.checked);
            };
            inputs.push(
                <div>
                    <div className='checkbox'>
                        <label>
                            <input type='checkbox' checked={this.state.mentionKey} onChange={handleUpdateMentionKey}>{'Your username mentioned "@' + user.username + '"'}</input>
                        </label>
                    </div>
                </div>
            );

            handleUpdateAllKey = function handleAllKeyChange(e) {
                self.updateAllKey(e.target.checked);
            };
            inputs.push(
                <div>
                    <div className='checkbox'>
                        <label>
                            <input type='checkbox' checked={this.state.allKey} onChange={handleUpdateAllKey}>{'Team-wide mentions "@all"'}</input>
                        </label>
                    </div>
                </div>
            );

            handleUpdateChannelKey = function handleChannelKeyChange(e) {
                self.updateChannelKey(e.target.checked);
            };
            inputs.push(
                <div>
                    <div className='checkbox'>
                        <label>
                            <input type='checkbox' checked={this.state.channelKey} onChange={handleUpdateChannelKey}>{'Channel-wide mentions "@channel"'}</input>
                        </label>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <div className='checkbox'>
                        <label>
                            <input ref='customcheck' type='checkbox' checked={this.state.customKeysChecked} onChange={this.updateCustomMentionKeys}>{'Other non-case sensitive words, separated by commas:'}</input>
                        </label>
                    </div>
                    <input ref='custommentions' className='form-control mentions-input' type='text' defaultValue={this.state.customKeys} onChange={this.onCustomChange} />
                </div>
            );

            handleUpdateKeysSection = function updateKeysSection(e) {
                self.props.updateSection('');
                e.preventDefault();
            };

            keysSection = (
                <SettingItemMax
                    title='Words that trigger mentions'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={handleUpdateKeysSection}
                />
            );
        } else {
            var keys = [];
            if (this.state.firstNameKey) {
                keys.push(user.first_name);
            }
            if (this.state.usernameKey) {
                keys.push(user.username);
            }
            if (this.state.mentionKey) {
                keys.push('@' + user.username);
            }
            if (this.state.allKey) {
                keys.push('@all');
            }
            if (this.state.channelKey) {
                keys.push('@channel');
            }
            if (this.state.customKeys.length > 0) {
                keys = keys.concat(this.state.customKeys.split(','));
            }

            for (var i = 0; i < keys.length; i++) {
                describeKeys += '"' + keys[i] + '", ';
            }

            if (describeKeys.length > 0) {
                describeKeys = describeKeys.substring(0, describeKeys.length - 2);
            } else {
                describeKeys = 'No words configured';
            }

            handleUpdateKeysSection = function updateKeysSection() {
                self.props.updateSection('keys');
            };

            keysSection = (
                <SettingItemMin
                    title='Words that trigger mentions'
                    describe={describeKeys}
                    updateSection={handleUpdateKeysSection}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                    <h4 className='modal-title' ref='title'><i className='modal-back'></i>Notifications</h4>
                </div>
                <div ref='wrapper' className='user-settings'>
                    <h3 className='tab-header'>Notifications</h3>
                    <div className='divider-dark first'/>
                    {desktopSection}
                    <div className='divider-light'/>
                    {soundSection}
                    <div className='divider-light'/>
                    {emailSection}
                    <div className='divider-light'/>
                    {keysSection}
                    <div className='divider-dark'/>
                </div>
            </div>

        );
    }
});

var SecurityTab = React.createClass({
    submitPassword: function(e) {
        e.preventDefault();

        var user = this.props.user;
        var currentPassword = this.state.currentPassword;
        var newPassword = this.state.newPassword;
        var confirmPassword = this.state.confirmPassword;

        if (currentPassword === '') {
            this.setState({passwordError: 'Please enter your current password', serverError: ''});
            return;
        }

        if (newPassword.length < 5) {
            this.setState({passwordError: 'New passwords must be at least 5 characters', serverError: ''});
            return;
        }

        if (newPassword !== confirmPassword) {
            this.setState({passwordError: 'The new passwords you entered do not match', serverError: ''});
            return;
        }

        var data = {};
        data.user_id = user.id;
        data.current_password = currentPassword;
        data.new_password = newPassword;

        client.updatePassword(data,
            function() {
                this.props.updateSection('');
                AsyncClient.getMe();
                this.setState({currentPassword: '', newPassword: '', confirmPassword: ''});
            }.bind(this),
            function(err) {
                var state = this.getInitialState();
                if (err.message) {
                    state.serverError = err.message;
                } else {
                    state.serverError = err;
                }
                state.passwordError = '';
                this.setState(state);
            }.bind(this)
        );
    },
    updateCurrentPassword: function(e) {
        this.setState({currentPassword: e.target.value});
    },
    updateNewPassword: function(e) {
        this.setState({newPassword: e.target.value});
    },
    updateConfirmPassword: function(e) {
        this.setState({confirmPassword: e.target.value});
    },
    handleHistoryOpen: function() {
        this.setState({willReturn: true});
        $("#user_settings").modal('hide');
    },
    handleDevicesOpen: function() {
        this.setState({willReturn: true});
        $("#user_settings").modal('hide');
    },
    handleClose: function() {
        $(this.getDOMNode()).find('.form-control').each(function() {
            this.value = '';
        });
        this.setState({currentPassword: '', newPassword: '', confirmPassword: '', serverError: null, passwordError: null});

        if (!this.state.willReturn) {
            this.props.updateTab('general');
        } else {
            this.setState({willReturn: false});
        }
    },
    componentDidMount: function() {
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    },
    componentWillUnmount: function() {
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
        this.props.updateSection('');
    },
    getInitialState: function() {
        return {currentPassword: '', newPassword: '', confirmPassword: '', willReturn: false};
    },
    render: function() {
        var serverError = this.state.serverError ? this.state.serverError : null;
        var passwordError = this.state.passwordError ? this.state.passwordError : null;

        var updateSectionStatus;
        var passwordSection;
        var self = this;
        if (this.props.activeSection === 'password') {
            var inputs = [];
            var submit = null;

            if (this.props.user.auth_service === '') {
                inputs.push(
                    <div className='form-group'>
                        <label className='col-sm-5 control-label'>Current Password</label>
                        <div className='col-sm-7'>
                            <input className='form-control' type='password' onChange={this.updateCurrentPassword} value={this.state.currentPassword}/>
                        </div>
                    </div>
                );
                inputs.push(
                    <div className='form-group'>
                        <label className='col-sm-5 control-label'>New Password</label>
                        <div className='col-sm-7'>
                            <input className='form-control' type='password' onChange={this.updateNewPassword} value={this.state.newPassword}/>
                        </div>
                    </div>
                );
                inputs.push(
                    <div className='form-group'>
                        <label className='col-sm-5 control-label'>Retype New Password</label>
                        <div className='col-sm-7'>
                            <input className='form-control' type='password' onChange={this.updateConfirmPassword} value={this.state.confirmPassword}/>
                        </div>
                    </div>
                );

                submit = this.submitPassword;
            } else {
                inputs.push(
                    <div className='form-group'>
                        <label className='col-sm-12'>Log in occurs through GitLab. Please see your GitLab account settings page to update your password.</label>
                    </div>
                );
            }

            updateSectionStatus = function(e) {
                self.props.updateSection('');
                self.setState({currentPassword: '', newPassword: '', confirmPassword: '', serverError: null, passwordError: null});
                e.preventDefault();
            };

            passwordSection = (
                <SettingItemMax
                    title='Password'
                    inputs={inputs}
                    submit={submit}
                    server_error={serverError}
                    client_error={passwordError}
                    updateSection={updateSectionStatus}
                />
            );
        } else {
            var describe;
            if (this.props.user.auth_service === '') {
                var d = new Date(this.props.user.last_password_update);
                var hour = d.getHours() % 12 ? String(d.getHours() % 12) : '12';
                var min = d.getMinutes() < 10 ? '0' + d.getMinutes() : String(d.getMinutes());
                var timeOfDay = d.getHours() >= 12 ? ' pm' : ' am';
                describe = 'Last updated ' + Constants.MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' at ' + hour + ':' + min + timeOfDay;
            } else {
                describe = 'Log in done through GitLab';
            }

            updateSectionStatus = function() {
                self.props.updateSection('password');
            };

            passwordSection = (
                <SettingItemMin
                    title='Password'
                    describe={describe}
                    updateSection={updateSectionStatus}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                    <h4 className='modal-title' ref='title'><i className='modal-back'></i>Security Settings</h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>Security Settings</h3>
                    <div className='divider-dark first'/>
                    {passwordSection}
                    <div className='divider-dark'/>
                    <br></br>
                    <a data-toggle='modal' className='security-links theme' data-target='#access-history' href='#' onClick={this.handleHistoryOpen}><i className='fa fa-clock-o'></i>View Access History</a>
                    <b> </b>
                    <a data-toggle='modal' className='security-links theme' data-target='#activity-log' href='#' onClick={this.handleDevicesOpen}><i className='fa fa-globe'></i>View and Logout of Active Sessions</a>
                </div>
            </div>
        );
    }
});

var GeneralTab = React.createClass({
    submitActive: false,
    submitUsername: function(e) {
        e.preventDefault();

        var user = this.props.user;
        var username = this.state.username.trim();

        var usernameError = utils.isValidUsername(username);
        if (usernameError === 'Cannot use a reserved word as a username.') {
            this.setState({clientError: 'This username is reserved, please choose a new one.'});
            return;
        } else if (usernameError) {
            this.setState({clientError: "Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'."});
            return;
        }

        if (user.username === username) {
            this.setState({clientError: 'You must submit a new username'});
            return;
        }

        user.username = username;

        this.submitUser(user);
    },
    submitNickname: function(e) {
        e.preventDefault();

        var user = UserStore.getCurrentUser();
        var nickname = this.state.nickname.trim();

        if (user.nickname === nickname) {
            this.setState({clientError: 'You must submit a new nickname'});
            return;
        }

        user.nickname = nickname;

        this.submitUser(user);
    },
    submitName: function(e) {
        e.preventDefault();

        var user = UserStore.getCurrentUser();
        var firstName = this.state.firstName.trim();
        var lastName = this.state.lastName.trim();

        if (user.first_name === firstName && user.last_name === lastName) {
            this.setState({clientError: 'You must submit a new first or last name'});
            return;
        }

        user.first_name = firstName;
        user.last_name = lastName;

        this.submitUser(user);
    },
    submitEmail: function(e) {
        e.preventDefault();

        var user = UserStore.getCurrentUser();
        var email = this.state.email.trim().toLowerCase();

        if (user.email === email) {
            return;
        }

        if (email === '' || !utils.isEmail(email)) {
            this.setState({emailError: 'Please enter a valid email address'});
            return;
        }

        user.email = email;

        this.submitUser(user);
    },
    submitUser: function(user) {
        client.updateUser(user,
            function() {
                this.updateSection('');
                AsyncClient.getMe();
            }.bind(this),
            function(err) {
                var state = this.getInitialState();
                if (err.message) {
                    state.serverError = err.message;
                } else {
                    state.serverError = err;
                }
                this.setState(state);
            }.bind(this)
        );
    },
    submitPicture: function(e) {
        e.preventDefault();

        if (!this.state.picture) {
            return;
        }

        if (!this.submitActive) {
            return;
        }

        var picture = this.state.picture;

        if (picture.type !== 'image/jpeg' && picture.type !== 'image/png') {
            this.setState({clientError: 'Only JPG or PNG images may be used for profile pictures'});
            return;
        }

        var formData = new FormData();
        formData.append('image', picture, picture.name);
        this.setState({loadingPicture: true});

        client.uploadProfileImage(formData,
            function() {
                this.submitActive = false;
                AsyncClient.getMe();
                window.location.reload();
            }.bind(this),
            function(err) {
                var state = this.getInitialState();
                state.serverError = err;
                this.setState(state);
            }.bind(this)
        );
    },
    updateUsername: function(e) {
        this.setState({username: e.target.value});
    },
    updateFirstName: function(e) {
        this.setState({firstName: e.target.value});
    },
    updateLastName: function(e) {
        this.setState({lastName: e.target.value});
    },
    updateNickname: function(e) {
        this.setState({nickname: e.target.value});
    },
    updateEmail: function(e) {
        this.setState({email: e.target.value});
    },
    updatePicture: function(e) {
        if (e.target.files && e.target.files[0]) {
            this.setState({picture: e.target.files[0]});

            this.submitActive = true;
            this.setState({clientError: null});
        } else {
            this.setState({picture: null});
        }
    },
    updateSection: function(section) {
        this.setState({clientError: ''});
        this.submitActive = false;
        this.props.updateSection(section);
    },
    handleClose: function() {
        $(this.getDOMNode()).find('.form-control').each(function() {
            this.value = '';
        });

        this.setState(assign({}, this.getInitialState(), {clientError: null, serverError: null, emailError: null}));
        this.props.updateSection('');
    },
    componentDidMount: function() {
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    },
    componentWillUnmount: function() {
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
    },
    getInitialState: function() {
        var user = this.props.user;

        return {username: user.username, firstName: user.first_name, lastName: user.last_name, nickname: user.nickname,
                 email: user.email, picture: null, loadingPicture: false};
    },
    render: function() {
        var user = this.props.user;

        var clientError = null;
        if (this.state.clientError) {
            clientError = this.state.clientError;
        }
        var serverError = null;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }
        var emailError = null;
        if (this.state.emailError) {
            emailError = this.state.emailError;
        }

        var nameSection;
        var self = this;
        var inputs = [];

        if (this.props.activeSection === 'name') {
            inputs.push(
                <div className='form-group'>
                    <label className='col-sm-5 control-label'>First Name</label>
                    <div className='col-sm-7'>
                        <input className='form-control' type='text' onChange={this.updateFirstName} value={this.state.firstName}/>
                    </div>
                </div>
            );

            inputs.push(
                <div className='form-group'>
                    <label className='col-sm-5 control-label'>Last Name</label>
                    <div className='col-sm-7'>
                        <input className='form-control' type='text' onChange={this.updateLastName} value={this.state.lastName}/>
                    </div>
                </div>
            );

            nameSection = (
                <SettingItemMax
                    title='Full Name'
                    inputs={inputs}
                    submit={this.submitName}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={function(e) {
                        self.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            var fullName = '';

            if (user.first_name && user.last_name) {
                fullName = user.first_name + ' ' + user.last_name;
            } else if (user.first_name) {
                fullName = user.first_name;
            } else if (user.last_name) {
                fullName = user.last_name;
            }

            nameSection = (
                <SettingItemMin
                    title='Full Name'
                    describe={fullName}
                    updateSection={function() {
                        self.updateSection('name');
                    }}
                />
            );
        }

        var nicknameSection;
        if (this.props.activeSection === 'nickname') {
            inputs.push(
                <div className='form-group'>
                    <label className='col-sm-5 control-label'>{utils.isMobile() ? '' : 'Nickname'}</label>
                    <div className='col-sm-7'>
                        <input className='form-control' type='text' onChange={this.updateNickname} value={this.state.nickname}/>
                    </div>
                </div>
            );

            nicknameSection = (
                <SettingItemMax
                    title='Nickname'
                    inputs={inputs}
                    submit={this.submitNickname}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={function(e) {
                        self.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            nicknameSection = (
                <SettingItemMin
                    title='Nickname'
                    describe={UserStore.getCurrentUser().nickname}
                    updateSection={function() {
                        self.updateSection('nickname');
                    }}
                />
            );
        }

        var usernameSection;
        if (this.props.activeSection === 'username') {
            inputs.push(
                <div className='form-group'>
                    <label className='col-sm-5 control-label'>{utils.isMobile() ? '' : 'Username'}</label>
                    <div className='col-sm-7'>
                        <input className='form-control' type='text' onChange={this.updateUsername} value={this.state.username}/>
                    </div>
                </div>
            );

            usernameSection = (
                <SettingItemMax
                    title='Username'
                    inputs={inputs}
                    submit={this.submitUsername}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={function(e) {
                        self.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            usernameSection = (
                <SettingItemMin
                    title='Username'
                    describe={UserStore.getCurrentUser().username}
                    updateSection={function() {
                        self.updateSection('username');
                    }}
                />
            );
        }
        var emailSection;
        if (this.props.activeSection === 'email') {
            inputs.push(
                <div className='form-group'>
                    <label className='col-sm-5 control-label'>Primary Email</label>
                    <div className='col-sm-7'>
                        <input className='form-control' type='text' onChange={this.updateEmail} value={this.state.email}/>
                    </div>
                </div>
            );

            emailSection = (
                <SettingItemMax
                    title='Email'
                    inputs={inputs}
                    submit={this.submitEmail}
                    server_error={serverError}
                    client_error={emailError}
                    updateSection={function(e) {
                        self.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            emailSection = (
                <SettingItemMin
                    title='Email'
                    describe={UserStore.getCurrentUser().email}
                    updateSection={function() {
                        self.updateSection('email');
                    }}
                />
            );
        }

        var pictureSection;
        if (this.props.activeSection === 'picture') {
            pictureSection = (
                <SettingPicture
                    title='Profile Picture'
                    submit={this.submitPicture}
                    src={'/api/v1/users/' + user.id + '/image?time=' + user.last_picture_update}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={function(e) {
                        self.updateSection('');
                        e.preventDefault();
                    }}
                    picture={this.state.picture}
                    pictureChange={this.updatePicture}
                    submitActive={this.submitActive}
                    loadingPicture={this.state.loadingPicture}
                />
            );
        } else {
            var minMessage = 'Click \'Edit\' to upload an image.';
            if (user.last_picture_update) {
                minMessage = 'Image last updated ' + utils.displayDate(user.last_picture_update);
            }
            pictureSection = (
                <SettingItemMin
                    title='Profile Picture'
                    describe={minMessage}
                    updateSection={function() {
                        self.updateSection('picture');
                    }}
                />
            );
        }
        return (
            <div>
                <div className='modal-header'>
                    <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                    <h4 className='modal-title' ref='title'><i className='modal-back'></i>General Settings</h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>General Settings</h3>
                    <div className='divider-dark first'/>
                    {nameSection}
                    <div className='divider-light'/>
                    {usernameSection}
                    <div className='divider-light'/>
                    {nicknameSection}
                    <div className='divider-light'/>
                    {emailSection}
                    <div className='divider-light'/>
                    {pictureSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
});

var AppearanceTab = React.createClass({
    submitTheme: function(e) {
        e.preventDefault();
        var user = UserStore.getCurrentUser();
        if (!user.props) user.props = {};
        user.props.theme = this.state.theme;

        client.updateUser(user,
            function(data) {
                this.props.updateSection("");
                window.location.reload();
            }.bind(this),
            function(err) {
                state = this.getInitialState();
                state.server_error = err;
                this.setState(state);
            }.bind(this)
        );
    },
    updateTheme: function(e) {
        var hex = utils.rgb2hex(e.target.style.backgroundColor);
        this.setState({ theme: hex.toLowerCase() });
    },
    handleClose: function() {
        this.setState({server_error: null});
        this.props.updateTab('general');
    },
    componentDidMount: function() {
        if (this.props.activeSection === "theme") {
            $(this.refs[this.state.theme].getDOMNode()).addClass('active-border');
        }
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    },
    componentDidUpdate: function() {
        if (this.props.activeSection === "theme") {
            $('.color-btn').removeClass('active-border');
            $(this.refs[this.state.theme].getDOMNode()).addClass('active-border');
        }
    },
    componentWillUnmount: function() {
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
        this.props.updateSection('');
    },
    getInitialState: function() {
        var user = UserStore.getCurrentUser();
        var theme = config.ThemeColors != null ? config.ThemeColors[0] : "#2389d7";
        if (user.props && user.props.theme) {
            theme = user.props.theme;
        }
        return { theme: theme.toLowerCase() };
    },
    render: function() {
        var server_error = this.state.server_error ? this.state.server_error : null;


        var themeSection;
        var self = this;

        if (config.ThemeColors != null) {
            if (this.props.activeSection === 'theme') {
                var theme_buttons = [];

                for (var i = 0; i < config.ThemeColors.length; i++) {
                    theme_buttons.push(<button ref={config.ThemeColors[i]} type="button" className="btn btn-lg color-btn" style={{backgroundColor: config.ThemeColors[i]}} onClick={this.updateTheme} />);
                }

                var inputs = [];

                inputs.push(
                    <li className="setting-list-item">
                        <div className="btn-group" data-toggle="buttons-radio">
                            { theme_buttons }
                        </div>
                    </li>
                );

                themeSection = (
                    <SettingItemMax
                        title="Theme Color"
                        inputs={inputs}
                        submit={this.submitTheme}
                        server_error={server_error}
                        updateSection={function(e){self.props.updateSection("");e.preventDefault;}}
                    />
                );
            } else {
                themeSection = (
                    <SettingItemMin
                        title="Theme Color"
                        describe={this.state.theme}
                        updateSection={function(){self.props.updateSection("theme");}}
                    />
                );
            }
        }

        return (
            <div>
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title"><i className="modal-back"></i>Appearance Settings</h4>
                </div>
                <div className="user-settings">
                    <h3 className="tab-header">Appearance Settings</h3>
                    <div className="divider-dark first"/>
                    {themeSection}
                    <div className="divider-dark"/>
                </div>
            </div>
        );
    }
});

module.exports = React.createClass({
    displayName: 'UserSettings',
    componentDidMount: function() {
        UserStore.addChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        UserStore.removeChangeListener(this._onChange);
    },
    _onChange: function () {
        var user = UserStore.getCurrentUser();
        if (!utils.areStatesEqual(this.state.user, user)) {
            this.setState({ user: user });
        }
    },
    getInitialState: function() {
        return { user: UserStore.getCurrentUser() };
    },
    render: function() {
        if (this.props.activeTab === 'general') {
            return (
                <div>
                    <GeneralTab user={this.state.user} activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
                </div>
            );
        } else if (this.props.activeTab === 'security') {
            return (
                <div>
                    <SecurityTab user={this.state.user} activeSection={this.props.activeSection} updateSection={this.props.updateSection} updateTab={this.props.updateTab} />
                </div>
            );
        } else if (this.props.activeTab === 'notifications') {
            return (
                <div>
                    <NotificationsTab user={this.state.user} activeSection={this.props.activeSection} updateSection={this.props.updateSection} updateTab={this.props.updateTab} />
                </div>
            );
        } else if (this.props.activeTab === 'appearance') {
            return (
                <div>
                    <AppearanceTab activeSection={this.props.activeSection} updateSection={this.props.updateSection} updateTab={this.props.updateTab} />
                </div>
            );
        } else {
            return <div/>;
        }
    }
});
