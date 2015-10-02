// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var NewEmailVerify = require('../components/new_email_verify.jsx');

function setupNewEmailVerifyPage(props) {
    React.render(
        <NewEmailVerify isVerified={props.IsVerified}/>,
        document.getElementById('new_email_verify')
    );
}

global.window.setupNewEmailVerifyPage = setupNewEmailVerifyPage;
