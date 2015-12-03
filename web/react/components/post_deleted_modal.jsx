// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from '../stores/user_store.jsx';

export default class PostDeletedModal extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }
    render() {
        var currentUser = UserStore.getCurrentUser();

        const title = 'Thread deleted';
        const description = 'Someone deleted the thread you were viewing.';

        if (currentUser != null) {
            return (
                <div
                    className='modal fade'
                    ref='modal'
                    id='post_deleted'
                    tabIndex='-1'
                    role='dialog'
                    aria-hidden='true'
                >
                    <div className='modal-dialog'>
                        <div className='modal-content'>
                            <div className='modal-header'>
                                <button
                                    type='button'
                                    className='close'
                                    data-dismiss='modal'
                                    aria-label='Close'
                                >
                                    <span aria-hidden='true'>{'×'}</span>
                                </button>
                                <h4
                                    className='modal-title'
                                    id='myModalLabel'
                                >
                                    {title}
                                </h4>
                            </div>
                            <div className='modal-body'>
                                <p>{description}</p>
                            </div>
                            <div className='modal-footer'>
                                <button
                                    type='button'
                                    className='btn btn-primary'
                                    data-dismiss='modal'
                                >
                                    {'Okay'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return <div/>;
    }
}
