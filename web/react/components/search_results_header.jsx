// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostStore from '../stores/post_store.jsx';

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
var ActionTypes = Constants.ActionTypes;

export default class SearchResultsHeader extends React.Component {
    constructor(props) {
        super(props);

        this.handleClose = this.handleClose.bind(this);
    }
    handleClose(e) {
        e.preventDefault();
        PostStore.closeRHS();
    }
    render() {
        var title = 'Search Results';

        if (this.props.isMentionSearch) {
            title = 'Recent Mentions';
        }

        return (
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>{title}</span>
                <button
                    type='button'
                    className='sidebar--right__close'
                    aria-label='Close'
                    title='Close'
                    onClick={this.handleClose}
                >
                    <i className='fa fa-sign-out'/>
                </button>
            </div>
        );
    }
}

SearchResultsHeader.propTypes = {
    isMentionSearch: React.PropTypes.bool
};
