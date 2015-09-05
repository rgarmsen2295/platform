// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var NewEmailVerify = require('../components/new_email_verify.jsx');

global.window.setupNewEmailVerifyPage = function setupNewEmailVerifyPage() {
    React.render(
        <NewEmailVerify />,
        document.getElementById('new_email_verify')
    );
};
