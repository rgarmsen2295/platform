// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var PostStore = require('../stores/post_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var PreferenceStore = require('../stores/preference_store.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var Utils = require('../utils/utils.jsx');
var SearchBox = require('./search_bar.jsx');
var CreateComment = require('./create_comment.jsx');
var RhsHeaderPost = require('./rhs_header_post.jsx');
var RootPost = require('./rhs_root_post.jsx');
var Comment = require('./rhs_comment.jsx');
var Constants = require('../utils/constants.jsx');
var SocketEvents = Constants.SocketEvents;
var FileUploadOverlay = require('./file_upload_overlay.jsx');

export default class RhsThread extends React.Component {
    constructor(props) {
        super(props);

        this.mounted = false;

        this.onSocketChange = this.onSocketChange.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onChangeAll = this.onChangeAll.bind(this);
        this.forceUpdateInfo = this.forceUpdateInfo.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleDeletedPost = this.handleDeletedPost.bind(this);
        this.checkUpdateState = this.checkUpdateState.bind(this);
        this.getRootPost = this.getRootPost.bind(this);

        const state = this.getStateFromStores();
        state.windowWidth = Utils.windowWidth();
        state.windowHeight = Utils.windowHeight();
        this.state = state;
    }
    getStateFromStores() {
        var selectedList = PostStore.getSelectedPost();
        if (!selectedList || selectedList.order.length < 1) {
            return {postList: {}};
        }

        // If we have a good post list but a removed selected post, set the selected post to be the root post
        if (selectedList.posts && !selectedList.posts[selectedList.order[0]]) {
            if (this.state && this.state.selectedPost) {
                const selectedPost = this.state.selectedPost;
                if (selectedPost.root_id === '') {
                    selectedList.order = [selectedPost.id];
                } else {
                    selectedList.order = [selectedPost.root_id];
                }
                PostStore.storeSelectedPost(selectedList);
            }
        }

        if (selectedList.posts && !selectedList.posts[selectedList.order[0]]) {
            return {postList: {}};
        }

        var channelId = selectedList.posts[selectedList.order[0]].channel_id;
        var pendingPostsList = PostStore.getPendingPosts(channelId);

        if (pendingPostsList) {
            for (var pid in pendingPostsList.posts) {
                if (pendingPostsList.posts.hasOwnProperty(pid)) {
                    selectedList.posts[pid] = pendingPostsList.posts[pid];
                }
            }
        }

        const newSelectedPost = selectedList.posts[selectedList.order[0]];

        return {postList: selectedList, selectedPost: newSelectedPost};
    }
    componentWillMount() {
        // check here does not work yet
    }
    componentDidMount() {
        PostStore.addSelectedPostChangeListener(this.onChange);
        PostStore.addChangeListener(this.onChangeAll);
        PreferenceStore.addChangeListener(this.forceUpdateInfo);
        SocketStore.addChangeListener(this.onSocketChange);

        this.resize();
        window.addEventListener('resize', this.handleResize);
        this.mounted = true;
    }
    componentDidUpdate() {
        if ($('.post-right__scroll')[0]) {
            $('.post-right__scroll').scrollTop($('.post-right__scroll')[0].scrollHeight);
        }
        this.resize();
    }
    componentWillUnmount() {
        PostStore.removeSelectedPostChangeListener(this.onChange);
        PostStore.removeChangeListener(this.onChangeAll);
        PreferenceStore.removeChangeListener(this.forceUpdateInfo);
        SocketStore.removeChangeListener(this.onSocketChange);

        window.removeEventListener('resize', this.handleResize);
        this.mounted = false;
    }
    forceUpdateInfo() {
        if (this.state.postList) {
            for (var postId in this.state.postList.posts) {
                if (this.refs[postId]) {
                    this.refs[postId].forceUpdate();
                }
            }
        }
    }
    handleResize() {
        this.setState({
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight()
        });
    }
    onSocketChange(msg) {
        if (msg.action === SocketEvents.POST_DELETED) {
            const deletedPost = JSON.parse(msg.props.post);
            const rootPost = this.getRootPost(this.state.postList);
            const curUserId = UserStore.getCurrentId();

            // Show the modal if the root post is gone and the deleted post is in fact a root that you didn't delete
            if (this.mounted && deletedPost && deletedPost.root_id.length === 0 && (!rootPost || rootPost.id === deletedPost.id)) {
                if (deletedPost.user_id !== curUserId || msg.props.user_id !== curUserId) {
                    this.handleDeletedPost();
                }

                PostStore.closeRHS();
            }
        }
    }
    onChange() {
        this.checkUpdateState();
    }
    onChangeAll() {
        // if something was changed in the channel like adding a
        // comment or post then lets refresh the sidebar list
        var currentSelected = PostStore.getSelectedPost();
        if (!currentSelected || currentSelected.order.length === 0 || !currentSelected.posts[currentSelected.order[0]]) {
            return;
        }

        var currentPosts = PostStore.getPosts(currentSelected.posts[currentSelected.order[0]].channel_id);

        if (!currentPosts || currentPosts.order.length === 0) {
            return;
        }

        if (currentPosts.posts[currentPosts.order[0]].channel_id === currentSelected.posts[currentSelected.order[0]].channel_id) {
            currentSelected.posts = {};
            for (var postId in currentPosts.posts) {
                if (currentPosts.posts.hasOwnProperty(postId)) {
                    currentSelected.posts[postId] = currentPosts.posts[postId];
                }
            }

            PostStore.storeSelectedPost(currentSelected);
        }

        this.checkUpdateState();
    }
    checkUpdateState() {
        var newState = this.getStateFromStores();
        if (this.mounted && !Utils.areObjectsEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    resize() {
        $('.post-right__scroll').scrollTop(100000);
        if (this.state.windowWidth > 768) {
            $('.post-right__scroll').perfectScrollbar();
            $('.post-right__scroll').perfectScrollbar('update');
        }
    }
    handleDeletedPost() {
        if ($('#post_deleted').length > 0) {
            $('#post_deleted').modal('show');
        }
    }
    getRootPost(postList) {
        if (postList == null || !postList.order) {
            return null;
        }

        var selectedPost = postList.posts[postList.order[0]];
        var rootPost = null;

        if (selectedPost.root_id === '') {
            rootPost = selectedPost;
        } else {
            rootPost = postList.posts[selectedPost.root_id];
            if (!rootPost) {
                rootPost = selectedPost;
            }
        }

        return rootPost;
    }
    render() {
        const postList = this.state.postList;
        const rootPost = this.getRootPost(postList);
        const postsArray = [];

        if (rootPost && rootPost.state !== Constants.POST_DELETED) {
            for (var postId in postList.posts) {
                if (postList.posts.hasOwnProperty(postId)) {
                    var cpost = postList.posts[postId];
                    if (cpost.root_id === rootPost.id) {
                        postsArray.push(cpost);
                    }
                }
            }
        } else {
            return (
                <div></div>
            );
        }

        const selectedPost = postList.posts[postList.order[0]];

        // sort failed posts to bottom, followed by pending, and then regular posts
        postsArray.sort(function postSort(a, b) {
            if ((a.state === Constants.POST_LOADING || a.state === Constants.POST_FAILED) && (b.state !== Constants.POST_LOADING && b.state !== Constants.POST_FAILED)) {
                return 1;
            }
            if ((a.state !== Constants.POST_LOADING && a.state !== Constants.POST_FAILED) && (b.state === Constants.POST_LOADING || b.state === Constants.POST_FAILED)) {
                return -1;
            }

            if (a.state === Constants.POST_LOADING && b.state === Constants.POST_FAILED) {
                return -1;
            }
            if (a.state === Constants.POST_FAILED && b.state === Constants.POST_LOADING) {
                return 1;
            }

            if (a.create_at < b.create_at) {
                return -1;
            }
            if (a.create_at > b.create_at) {
                return 1;
            }
            return 0;
        });

        const currentId = UserStore.getCurrentId();
        var searchForm;
        if (currentId != null) {
            searchForm = <SearchBox />;
        }

        return (
            <div className='post-right__container'>
                <FileUploadOverlay overlayType='right' />
                <div className='search-bar__container sidebar--right__search-header'>{searchForm}</div>
                <div className='sidebar-right__body'>
                    <RhsHeaderPost
                        fromSearch={this.props.fromSearch}
                        isMentionSearch={this.props.isMentionSearch}
                    />
                    <div className='post-right__scroll'>
                        <RootPost
                            ref={rootPost.id}
                            post={rootPost}
                            commentCount={postsArray.length}
                        />
                        <div className='post-right-comments-container'>
                        {postsArray.map(function mapPosts(comPost) {
                            return (
                                <Comment
                                    ref={comPost.id}
                                    key={comPost.id + 'commentKey'}
                                    post={comPost}
                                    selected={(comPost.id === selectedPost.id)}
                                />
                            );
                        })}
                        </div>
                        <div className='post-create__container'>
                            <CreateComment
                                channelId={rootPost.channel_id}
                                rootId={rootPost.id}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

RhsThread.defaultProps = {
    fromSearch: '',
    isMentionSearch: false
};

RhsThread.propTypes = {
    fromSearch: React.PropTypes.string,
    isMentionSearch: React.PropTypes.bool
};
