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
        let title = 'Thanks!';
        let info = 'Your email address has been confirmed.';
        if (this.props.isVerified === 'false') {
            title = 'Whoops!';
            info = <div>{'You have already completed the email verification process for this email or this link has expired.'}</div>;
        }

        return (
            <div className='col-sm-offset-4 col-sm-4'>
                <div className='panel panel-default'>
                    <div className='panel-heading'>
                        <h3 className='panel-title'>{title}</h3>
                    </div>
                    <div className='panel-body'>
                        <p>{info}</p>
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

NewEmailVerify.defaultProps = {
    isVerified: 'false'
};
NewEmailVerify.propTypes = {
    isVerified: React.PropTypes.string
};
