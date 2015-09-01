// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var TeamStore = require('../stores/team_store.jsx');

var Constants = require('../utils/constants.jsx');

function getStateFromStores() {
    return {teams: UserStore.getTeams(), currentTeam: TeamStore.getCurrent()};
}

export default class NavbarDropdown extends React.Component {
    constructor(props) {
        super(props);
        this.blockToggle = false;

        this.handleLogoutClick = this.handleLogoutClick.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);

        this.state = getStateFromStores();
    }
    handleLogoutClick(e) {
        e.preventDefault();
        client.logout();
    }
    componentDidMount() {
        UserStore.addTeamsChangeListener(this.onListenerChange);
        TeamStore.addChangeListener(this.onListenerChange);

        var self = this;
        $(this.refs.dropdown.getDOMNode()).on('hide.bs.dropdown', function resetDropdown() {
            self.blockToggle = true;
            setTimeout(function blockTimeout() {
                self.blockToggle = false;
            }, 100);
        });
    }
    componentWillUnmount() {
        UserStore.removeTeamsChangeListener(this.onListenerChange);
        TeamStore.removeChangeListener(this.onListenerChange);

        $(this.refs.dropdown.getDOMNode()).off('hide.bs.dropdown');
    }
    onListenerChange() {
        var newState = getStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    render() {
        var teamLink = '';
        var inviteLink = '';
        var manageLink = '';
        var currentUser = UserStore.getCurrentUser();
        var isAdmin = false;
        var teamSettings = null;

        if (currentUser != null) {
            isAdmin = currentUser.roles.indexOf('admin') > -1;

            inviteLink = (<li>
                            <a
                                    href='#'
                                    data-toggle='modal'
                                    data-target='#invite_member'
                                >
                                Invite New Member
                            </a>
                        </li>);

            if (this.props.teamType === 'O') {
                teamLink = (
                    <li>
                        <a
                            href='#'
                            data-toggle='modal'
                            data-target='#get_link'
                            data-title='Team Invite'
                            data-value={utils.getWindowLocationOrigin() + '/signup_user_complete/?id=' + currentUser.team_id}
                        >
                            Get Team Invite Link
                        </a>
                    </li>
                );
            }
        }

        if (isAdmin) {
            manageLink = (<li>
                            <a
                                    href='#'
                                    data-toggle='modal'
                                    data-target='#team_members'
                                >
                                    Manage Team
                            </a>
                        </li>);
            teamSettings = (<li>
                                <a
                                    href='#'
                                    data-toggle='modal'
                                    data-target='#team_settings'
                                >
                                    Team Settings
                                </a>
                            </li>);
        }

        var teams = [];

        teams.push(<li
                        className='divider'
                        key='div'
                    >
                    </li>);
        if (this.state.teams.length > 1 && this.state.currentTeam) {
            var curTeamName = this.state.currentTeam.name;
            this.state.teams.forEach(function listTeams(teamName) {
                if (teamName !== curTeamName) {
                    teams.push(<li key={teamName}><a href={utils.getWindowLocationOrigin() + '/' + teamName}>Switch to {teamName}</a></li>);
                }
            });
        }
        teams.push(<li key='newTeam_li'>
                        <a
                            key='newTeam_a'
                            target='_blank'
                            href={utils.getWindowLocationOrigin() + '/signup_team'}
                        >
                            Create a New Team
                        </a>
                    </li>);

        return (
            <ul className='nav navbar-nav navbar-right'>
                <li
                    ref='dropdown'
                    className='dropdown'
                >
                    <a
                        href='#'
                        className='dropdown-toggle'
                        data-toggle='dropdown'
                        role='button'
                        aria-expanded='false'
                    >
                        <span
                            className='dropdown__icon'
                            dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}}
                        />
                    </a>
                    <ul
                        className='dropdown-menu'
                        role='menu'
                    >
                        <li>
                            <a
                                href='#'
                                data-toggle='modal'
                                data-target='#user_settings'
                            >
                                Account Settings
                            </a>
                        </li>
                        {teamSettings}
                        {inviteLink}
                        {teamLink}
                        {manageLink}
                        <li>
                            <a
                                href='#'
                                onClick={this.handleLogoutClick}
                            >
                                Logout
                            </a>
                        </li>
                        {teams}
                        <li className='divider'></li>
                        <li>
                            <a
                                target='_blank'
                                href={config.HelpLink}
                            >
                                Help
                            </a>
                        </li>
                        <li>
                            <a
                                target='_blank'
                                href={config.ReportProblemLink}
                            >
                                Report a Problem
                            </a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
}

NavbarDropdown.defaultProps = {
    teamType: ''
};
NavbarDropdown.propTypes = {
    teamType: React.PropTypes.string
};
