// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var PostStore = require('../stores/post_store.jsx');
var CommandList = require('./command_list.jsx');
var ErrorStore = require('../stores/error_store.jsx');
var AsyncClient = require('../utils/async_client.jsx');

var utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

function getStateFromStores() {
    var error = ErrorStore.getLastError();

    if (error) {
        return {message: error.message};
    }
    return {message: null};
}

module.exports = React.createClass({
    displayName: 'Textbox',
    caret: -1,
    addedMention: false,
    doProcessMentions: false,
    mentions: [],
    componentDidMount: function() {
        PostStore.addAddMentionListener(this.onListenerChange);
        ErrorStore.addChangeListener(this.onRecievedError);

        this.resize();
        this.updateMentionTab(null);
    },
    componentWillUnmount: function() {
        PostStore.removeAddMentionListener(this.onListenerChange);
        ErrorStore.removeChangeListener(this.onRecievedError);
    },
    onListenerChange: function(id, username) {
        if (id === this.props.id) {
            this.addMention(username);
        }
    },
    onRecievedError: function() {
        var errorState = getStateFromStores();

        if (this.state.timerInterrupt != null) {
            window.clearInterval(this.state.timerInterrupt);
            this.setState({timerInterrupt: null});
        }

        if (errorState.message === 'There appears to be a problem with your internet connection') {
            this.setState({connection: 'bad-connection'});
            var timerInterrupt = window.setInterval(this.onTimerInterrupt, 5000);
            this.setState({timerInterrupt: timerInterrupt});
        } else {
            this.setState({connection: ''});
        }
    },
    onTimerInterrupt: function() {
        //Since these should only happen when you have no connection and slightly briefly after any
        //performance hit should not matter
        if (this.state.connection === 'bad-connection') {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_ERROR,
                err: null
            });

            AsyncClient.updateLastViewedAt();
        }

        window.clearInterval(this.state.timerInterrupt);
        this.setState({timerInterrupt: null});
    },
    componentDidUpdate: function() {
        if (this.caret >= 0) {
            utils.setCaretPosition(this.refs.message.getDOMNode(), this.caret);
            this.caret = -1;
        }
        if (this.doProcessMentions) {
            this.updateMentionTab(null);
            this.doProcessMentions = false;
        }
        this.resize();
    },
    componentWillReceiveProps: function(nextProps) {
        if (!this.addedMention) {
            this.checkForNewMention(nextProps.messageText);
        }
        var text = this.refs.message.getDOMNode().value;
        if (nextProps.channelId !== this.props.channelId || nextProps.messageText !== text) {
            this.doProcessMentions = true;
        }
        this.addedMention = false;
        this.refs.commands.getSuggestedCommands(nextProps.messageText);
        this.resize();
    },
    getInitialState: function() {
        return {mentionText: '-1', mentions: [], connection: '', timerInterrupt: null};
    },
    updateMentionTab: function(mentionText) {
        var self = this;

        // using setTimeout so dispatch isn't called during an in progress dispatch
        setTimeout(function() {
            AppDispatcher.handleViewAction({
                type: ActionTypes.RECIEVED_MENTION_DATA,
                id: self.props.id,
                mention_text: mentionText
            });
        }, 1);
    },
    handleChange: function() {
        this.props.onUserInput(this.refs.message.getDOMNode().value);
        this.resize();
    },
    handleKeyPress: function(e) {
        var text = this.refs.message.getDOMNode().value;

        if (!this.refs.commands.isEmpty() && text.indexOf('/') === 0 && e.which === 13) {
            this.refs.commands.addFirstCommand();
            e.preventDefault();
            return;
        }

        if (!this.doProcessMentions) {
            var caret = utils.getCaretPosition(this.refs.message.getDOMNode());
            var preText = text.substring(0, caret);
            var lastSpace = preText.lastIndexOf(' ');
            var lastAt = preText.lastIndexOf('@');

            if (caret > lastAt && lastSpace < lastAt) {
                this.doProcessMentions = true;
            }
        }

        this.props.onKeyPress(e);
    },
    handleKeyDown: function(e) {
        if (utils.getSelectedText(this.refs.message.getDOMNode()) !== '') {
            this.doProcessMentions = true;
        }

        if (e.keyCode === 8) {
            this.handleBackspace(e);
        }
    },
    handleBackspace: function() {
        var text = this.refs.message.getDOMNode().value;
        if (text.indexOf('/') === 0) {
            this.refs.commands.getSuggestedCommands(text.substring(0, text.length - 1));
        }

        if (this.doProcessMentions) {
            return;
        }

        var caret = utils.getCaretPosition(this.refs.message.getDOMNode());
        var preText = text.substring(0, caret);
        var lastSpace = preText.lastIndexOf(' ');
        var lastAt = preText.lastIndexOf('@');

        if (caret > lastAt && (lastSpace > lastAt || lastSpace === -1)) {
            this.doProcessMentions = true;
        }
    },
    checkForNewMention: function(text) {
        var caret = utils.getCaretPosition(this.refs.message.getDOMNode());

        var preText = text.substring(0, caret);

        var atIndex = preText.lastIndexOf('@');

        // The @ character not typed, so nothing to do.
        if (atIndex === -1) {
            this.updateMentionTab('-1');
            return;
        }

        var lastCharSpace = preText.lastIndexOf(String.fromCharCode(160));
        var lastSpace = preText.lastIndexOf(' ');

        // If there is a space after the last @, nothing to do.
        if (lastSpace > atIndex || lastCharSpace > atIndex) {
            this.updateMentionTab('-1');
            return;
        }

        // Get the name typed so far.
        var name = preText.substring(atIndex + 1, preText.length).toLowerCase();
        this.updateMentionTab(name);
    },
    addMention: function(name) {
        var caret = utils.getCaretPosition(this.refs.message.getDOMNode());

        var text = this.props.messageText;

        var preText = text.substring(0, caret);

        var atIndex = preText.lastIndexOf('@');

        // The @ character not typed, so nothing to do.
        if (atIndex === -1) {
            return;
        }

        var prefix = text.substring(0, atIndex);
        var suffix = text.substring(caret, text.length);
        this.caret = prefix.length + name.length + 2;
        this.addedMention = true;
        this.doProcessMentions = true;

        this.props.onUserInput(prefix + '@' + name + ' ' + suffix);
    },
    addCommand: function(cmd) {
        var elm = this.refs.message.getDOMNode();
        elm.value = cmd;
        this.handleChange();
    },
    resize: function() {
        var e = this.refs.message.getDOMNode();
        var w = this.refs.wrapper.getDOMNode();

        var lht = parseInt($(e).css('lineHeight'), 10);
        var lines = e.scrollHeight / lht;
        var mod =  15;

        if (lines < 2.5 || this.props.messageText === '') {
            mod = 30;
        }

        if (e.scrollHeight - mod < 167) {
            $(e).css({height: 'auto', 'overflow-y': 'hidden'}).height(e.scrollHeight - mod);
            $(w).css({height: 'auto'}).height(e.scrollHeight + 2);
        } else {
            $(e).css({height: 'auto', 'overflow-y': 'scroll'}).height(167);
            $(w).css({height: 'auto'}).height(167);
        }
    },
    handleFocus: function() {
        var elm = this.refs.message.getDOMNode();
        if (elm.title === elm.value) {
            elm.value = '';
        }
    },
    handleBlur: function() {
        var elm = this.refs.message.getDOMNode();
        if (elm.value === '') {
            elm.value = elm.title;
        }
    },
    handlePaste: function() {
        this.doProcessMentions = true;
    },
    handleDrop: function(e) {
        var droppedFiles = e.dataTransfer.files;
        console.log('HERE!');
        this.props.messageText += droppedFiles[0];
    },
    render: function() {
        return (
            <div ref='wrapper' className='textarea-wrapper'>
                <CommandList ref='commands' addCommand={this.addCommand} channelId={this.props.channelId} />
                <textarea id={this.props.id} ref='message' className={'form-control custom-textarea ' + this.state.connection} spellCheck='true' autoComplete='off' autoCorrect='off' rows='1' placeholder={this.props.createMessage} value={this.props.messageText} onInput={this.handleChange} onChange={this.handleChange} onKeyPress={this.handleKeyPress} onKeyDown={this.handleKeyDown} onFocus={this.handleFocus} onBlur={this.handleBlur} onPaste={this.handlePaste} onDrop={this.handleDrop} />
            </div>
        );
    }
});
