// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');

module.exports = React.createClass({
	componentDidMount: function() {
        var self = this;
        if(this.refs.modal) {
          $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
              var button = e.relatedTarget;
              self.setState({ channel_id: $(button).attr('data-channelid') });
          });
        }
    },
    getInitialState: function() {
        return { channels: ChannelStore.getAll() };
    },
    handleSubmit: function() {
    	setDefaultChannels(this.state.channels);
    },
    setDefault: function(curChannel) {
    	var channels = this.state.channels;
    	channels[curChannel.id].is_default = !curChannel.is_default;
    	setState({channels: channels});
    },
    render: function() {
    	var currentUser = UserStore.getCurrentUser();

    	var channelList = this.state.channels;
    	var defaultList = []

    	if (currentUser.roles != "admin") return;

    	for (var curChannel in channelList) {

    		if (curChannel.name != town-square) {
    			/* Maybe use those slider buttons here instead for yes/no */
	    		defaultList[curChannel.id] = (
	    			<div key={"key" + curChannel.id}>
	    			<div><br/>{curChannel.name + "	"}</div>
	    			{ curChannel.is_default ?
	    			<div>
	    				<button type="button" className="btn btn-default" onClick={this.setDefault.bind(this, curChannel)}>Add to default channels</button>
	    			</div>
	    			  :
	    			<div>
	    				<button type="button" classNmae="btn btn-default" onClick={this.setDefault.bind(this, curChannel)}>Remove from default channels</button>
	    			</div>
	    			}
    		);
    		}
    	}

    	var server_error = this.state.server_error ? this.state.server_error : null;

    	<div className="modal-footer">
          <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
          <button onClick={this.handleSubmit} type="button" className="btn btn-primary">Send Invitations</button>
        </div>
    }
});