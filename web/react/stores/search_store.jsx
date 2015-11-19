// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;

var BrowserStore = require('../stores/browser_store.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var CHANGE_EVENT = 'change';
var SEARCH_CHANGE_EVENT = 'search_change';
var SEARCH_TERM_CHANGE_EVENT = 'search_term_change';
var MENTION_DATA_CHANGE_EVENT = 'mention_data_change';
var ADD_MENTION_EVENT = 'add_mention';

class SearchStoreClass extends EventEmitter {
    constructor() {
        super();

        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);

        this.emitSearchChange = this.emitSearchChange.bind(this);
        this.addSearchChangeListener = this.addSearchChangeListener.bind(this);
        this.removeSearchChangeListener = this.removeSearchChangeListener.bind(this);

        this.emitSearchTermChange = this.emitSearchTermChange.bind(this);
        this.addSearchTermChangeListener = this.addSearchTermChangeListener.bind(this);
        this.removeSearchTermChangeListener = this.removeSearchTermChangeListener.bind(this);

        this.emitMentionDataChange = this.emitMentionDataChange.bind(this);
        this.addMentionDataChangeListener = this.addMentionDataChangeListener.bind(this);
        this.removeMentionDataChangeListener = this.removeMentionDataChangeListener.bind(this);

        this.getSearchResults = this.getSearchResults.bind(this);
        this.getIsMentionSearch = this.getIsMentionSearch.bind(this);

        this.storeSearchTerm = this.storeSearchTerm.bind(this);
        this.getSearchTerm = this.getSearchTerm.bind(this);

        this.storeSearchResults = this.storeSearchResults.bind(this);
    }

    emitChange() {
        this.emit(CHANGE_EVENT);
    }

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }

    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }

    emitSearchChange() {
        this.emit(SEARCH_CHANGE_EVENT);
    }

    addSearchChangeListener(callback) {
        this.on(SEARCH_CHANGE_EVENT, callback);
    }

    removeSearchChangeListener(callback) {
        this.removeListener(SEARCH_CHANGE_EVENT, callback);
    }

    emitSearchTermChange(doSearch, isMentionSearch) {
        this.emit(SEARCH_TERM_CHANGE_EVENT, doSearch, isMentionSearch);
    }

    addSearchTermChangeListener(callback) {
        this.on(SEARCH_TERM_CHANGE_EVENT, callback);
    }

    removeSearchTermChangeListener(callback) {
        this.removeListener(SEARCH_TERM_CHANGE_EVENT, callback);
    }

    getSearchResults() {
        return BrowserStore.getItem('search_results');
    }

    getIsMentionSearch() {
        return BrowserStore.getItem('is_mention_search');
    }

    storeSearchTerm(term) {
        BrowserStore.setItem('search_term', term);
    }

    getSearchTerm() {
        return BrowserStore.getItem('search_term');
    }

    emitMentionDataChange(id, mentionText) {
        this.emit(MENTION_DATA_CHANGE_EVENT, id, mentionText);
    }

    addMentionDataChangeListener(callback) {
        this.on(MENTION_DATA_CHANGE_EVENT, callback);
    }

    removeMentionDataChangeListener(callback) {
        this.removeListener(MENTION_DATA_CHANGE_EVENT, callback);
    }

    emitAddMention(id, username) {
        this.emit(ADD_MENTION_EVENT, id, username);
    }

    addAddMentionListener(callback) {
        this.on(ADD_MENTION_EVENT, callback);
    }

    removeAddMentionListener(callback) {
        this.removeListener(ADD_MENTION_EVENT, callback);
    }

    storeSearchResults(results, isMentionSearch) {
        BrowserStore.setItem('search_results', results);
        BrowserStore.setItem('is_mention_search', Boolean(isMentionSearch));
    }

    receivedSearch(results, isMentionSearch) {
        this.storeSearchResults(results, isMentionSearch);
        this.emitSearchChange();
    }

    receivedSearchTerm(term, doSearch, isMentionSearch) {
        this.storeSearchTerm(term);
        this.emitSearchTermChange(doSearch, isMentionSearch);
    }
}

var SearchStore = new SearchStoreClass();

SearchStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_SEARCH:
        SearchStore.receivedSearch(action.results, action.is_mention_search);
        break;
    case ActionTypes.RECIEVED_SEARCH_TERM:
        SearchStore.receivedSearchTerm(action.term, action.do_search, action.is_mention_search);
        break;
    case ActionTypes.RECIEVED_MENTION_DATA:
        SearchStore.emitMentionDataChange(action.id, action.mention_text);
        break;
    case ActionTypes.RECIEVED_ADD_MENTION:
        SearchStore.emitAddMention(action.id, action.username);
        break;
    default:
    }
});

export default SearchStore;
