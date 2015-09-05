// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

export default class NewEmailVerify extends React.Component {
    constructor(props) {
        super(props);

        this.handleClose = this.handleClose.bind(this);

        this.state = {};
    }
    handleClose() {
        window.close();
    }
    render() {
        return (
            <div className='col-sm-offset-4 col-sm-4'>
                <div className='panel panel-default'>
                    <div className='panel-heading'>
                        <h3 className='panel-title'>{'Thanks!'}</h3>
                    </div>
                    <div className='panel-body'>
                        <p>{'Your email address has been confirmed.'}</p>
                        <button
                            onClick={this.handleClose}
                            className='btn btn-primary'
                        >
                            {'Close'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
