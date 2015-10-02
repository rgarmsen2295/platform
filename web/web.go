// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"github.com/mssola/user_agent"
	"gopkg.in/fsnotify.v1"
	"html/template"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

var Templates *template.Template

type HtmlTemplatePage api.Page

func NewHtmlTemplatePage(templateName string, title string) *HtmlTemplatePage {

	if len(title) > 0 {
		title = utils.Cfg.TeamSettings.SiteName + " - " + title
	}

	props := make(map[string]string)
	props["Title"] = title
	return &HtmlTemplatePage{TemplateName: templateName, Props: props, ClientProps: utils.ClientProperties}
}

func (me *HtmlTemplatePage) Render(c *api.Context, w http.ResponseWriter) {
	if err := Templates.ExecuteTemplate(w, me.TemplateName, me); err != nil {
		c.SetUnknownError(me.TemplateName, err.Error())
	}
}

func InitWeb() {
	l4g.Debug("Initializing web routes")

	mainrouter := api.Srv.Router

	staticDir := utils.FindDir("web/static")
	l4g.Debug("Using static directory at %v", staticDir)
	mainrouter.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	mainrouter.Handle("/", api.AppHandlerIndependent(root)).Methods("GET")
	mainrouter.Handle("/oauth/authorize", api.UserRequired(authorizeOAuth)).Methods("GET")
	mainrouter.Handle("/oauth/access_token", api.ApiAppHandler(getAccessToken)).Methods("POST")

	mainrouter.Handle("/signup_team_complete/", api.AppHandlerIndependent(signupTeamComplete)).Methods("GET")
	mainrouter.Handle("/signup_user_complete/", api.AppHandlerIndependent(signupUserComplete)).Methods("GET")
	mainrouter.Handle("/signup_team_confirm/", api.AppHandlerIndependent(signupTeamConfirm)).Methods("GET")
	mainrouter.Handle("/verify_email", api.AppHandlerIndependent(verifyEmail)).Methods("GET")
	mainrouter.Handle("/verify_new_email", api.AppHandlerIndependent(verifyNewEmail)).Methods("GET")
	mainrouter.Handle("/find_team", api.AppHandlerIndependent(findTeam)).Methods("GET")
	mainrouter.Handle("/signup_team", api.AppHandlerIndependent(signup)).Methods("GET")
	mainrouter.Handle("/login/{service:[A-Za-z]+}/complete", api.AppHandlerIndependent(loginCompleteOAuth)).Methods("GET")
	mainrouter.Handle("/signup/{service:[A-Za-z]+}/complete", api.AppHandlerIndependent(signupCompleteOAuth)).Methods("GET")

	mainrouter.Handle("/admin_console", api.UserRequired(adminConsole)).Methods("GET")

	mainrouter.Handle("/hooks/{id:[A-Za-z0-9]+}", api.ApiAppHandler(incomingWebhook)).Methods("POST")

	// ----------------------------------------------------------------------------------------------
	// *ANYTHING* team specific should go below this line
	// ----------------------------------------------------------------------------------------------

	mainrouter.Handle("/{team:[A-Za-z0-9-]+(__)?[A-Za-z0-9-]+}", api.AppHandler(login)).Methods("GET")
	mainrouter.Handle("/{team:[A-Za-z0-9-]+(__)?[A-Za-z0-9-]+}/", api.AppHandler(login)).Methods("GET")
	mainrouter.Handle("/{team:[A-Za-z0-9-]+(__)?[A-Za-z0-9-]+}/login", api.AppHandler(login)).Methods("GET")
	mainrouter.Handle("/{team:[A-Za-z0-9-]+(__)?[A-Za-z0-9-]+}/logout", api.AppHandler(logout)).Methods("GET")
	mainrouter.Handle("/{team:[A-Za-z0-9-]+(__)?[A-Za-z0-9-]+}/reset_password", api.AppHandler(resetPassword)).Methods("GET")
	mainrouter.Handle("/{team}/login/{service}", api.AppHandler(loginWithOAuth)).Methods("GET")      // Bug in gorilla.mux prevents us from using regex here.
	mainrouter.Handle("/{team}/channels/{channelname}", api.UserRequired(getChannel)).Methods("GET") // Bug in gorilla.mux prevents us from using regex here.
	mainrouter.Handle("/{team}/signup/{service}", api.AppHandler(signupWithOAuth)).Methods("GET")    // Bug in gorilla.mux prevents us from using regex here.

	watchAndParseTemplates()
}

func watchAndParseTemplates() {

	templatesDir := utils.FindDir("web/templates")
	l4g.Debug("Parsing templates at %v", templatesDir)
	var err error
	if Templates, err = template.ParseGlob(templatesDir + "*.html"); err != nil {
		l4g.Error("Failed to parse templates %v", err)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		l4g.Error("Failed to create directory watcher %v", err)
	}

	go func() {
		for {
			select {
			case event := <-watcher.Events:
				if event.Op&fsnotify.Write == fsnotify.Write {
					l4g.Info("Re-parsing templates because of modified file %v", event.Name)
					if Templates, err = template.ParseGlob(templatesDir + "*.html"); err != nil {
						l4g.Error("Failed to parse templates %v", err)
					}
				}
			case err := <-watcher.Errors:
				l4g.Error("Failed in directory watcher %v", err)
			}
		}
	}()

	err = watcher.Add(templatesDir)
	if err != nil {
		l4g.Error("Failed to add directory to watcher %v", err)
	}
}

var browsersNotSupported string = "MSIE/8;MSIE/9;Internet Explorer/8;Internet Explorer/9"

func CheckBrowserCompatability(c *api.Context, r *http.Request) bool {
	ua := user_agent.New(r.UserAgent())
	bname, bversion := ua.Browser()

	browsers := strings.Split(browsersNotSupported, ";")
	for _, browser := range browsers {
		version := strings.Split(browser, "/")

		if strings.HasPrefix(bname, version[0]) && strings.HasPrefix(bversion, version[1]) {
			c.Err = model.NewAppError("CheckBrowserCompatability", "Your current browser is not supported, please upgrade to one of the following browsers: Google Chrome 21 or higher, Internet Explorer 10 or higher, FireFox 14 or higher", "")
			return false
		}
	}

	return true

}

func root(c *api.Context, w http.ResponseWriter, r *http.Request) {

	if !CheckBrowserCompatability(c, r) {
		return
	}

	if len(c.Session.UserId) == 0 {
		page := NewHtmlTemplatePage("signup_team", "Signup")
		page.Render(c, w)
	} else {
		page := NewHtmlTemplatePage("home", "Home")
		page.Props["TeamURL"] = c.GetTeamURL()
		page.Render(c, w)
	}
}

func signup(c *api.Context, w http.ResponseWriter, r *http.Request) {

	if !CheckBrowserCompatability(c, r) {
		return
	}

	page := NewHtmlTemplatePage("signup_team", "Signup")
	page.Render(c, w)
}

func login(c *api.Context, w http.ResponseWriter, r *http.Request) {
	if !CheckBrowserCompatability(c, r) {
		return
	}
	params := mux.Vars(r)
	teamName := params["team"]

	var team *model.Team
	if tResult := <-api.Srv.Store.Team().GetByName(teamName); tResult.Err != nil {
		l4g.Error("Couldn't find team name=%v, teamURL=%v, err=%v", teamName, c.GetTeamURL(), tResult.Err.Message)
		http.Redirect(w, r, api.GetProtocol(r)+"://"+r.Host, http.StatusTemporaryRedirect)
		return
	} else {
		team = tResult.Data.(*model.Team)
	}

	// If we are already logged into this team then go to home
	if len(c.Session.UserId) != 0 && c.Session.TeamId == team.Id {
		page := NewHtmlTemplatePage("home", "Home")
		page.Props["TeamURL"] = c.GetTeamURL()
		page.Render(c, w)
		return
	}

	page := NewHtmlTemplatePage("login", "Login")
	page.Props["TeamDisplayName"] = team.DisplayName
	page.Props["TeamName"] = teamName
	page.Render(c, w)
}

func signupTeamConfirm(c *api.Context, w http.ResponseWriter, r *http.Request) {
	email := r.FormValue("email")

	page := NewHtmlTemplatePage("signup_team_confirm", "Signup Email Sent")
	page.Props["Email"] = email
	page.Render(c, w)
}

func signupTeamComplete(c *api.Context, w http.ResponseWriter, r *http.Request) {
	data := r.FormValue("d")
	hash := r.FormValue("h")

	if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
		c.Err = model.NewAppError("signupTeamComplete", "The signup link does not appear to be valid", "")
		return
	}

	props := model.MapFromJson(strings.NewReader(data))

	t, err := strconv.ParseInt(props["time"], 10, 64)
	if err != nil || model.GetMillis()-t > 1000*60*60*24*30 { // 30 days
		c.Err = model.NewAppError("signupTeamComplete", "The signup link has expired", "")
		return
	}

	page := NewHtmlTemplatePage("signup_team_complete", "Complete Team Sign Up")
	page.Props["Email"] = props["email"]
	page.Props["Data"] = data
	page.Props["Hash"] = hash
	page.Render(c, w)
}

func signupUserComplete(c *api.Context, w http.ResponseWriter, r *http.Request) {

	id := r.FormValue("id")
	data := r.FormValue("d")
	hash := r.FormValue("h")
	var props map[string]string

	if len(id) > 0 {
		props = make(map[string]string)

		if result := <-api.Srv.Store.Team().Get(id); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			team := result.Data.(*model.Team)
			if !(team.Type == model.TEAM_OPEN || (team.Type == model.TEAM_INVITE && len(team.AllowedDomains) > 0)) {
				c.Err = model.NewAppError("signupUserComplete", "The team type doesn't allow open invites", "id="+id)
				return
			}

			props["email"] = ""
			props["display_name"] = team.DisplayName
			props["name"] = team.Name
			props["id"] = team.Id
			data = model.MapToJson(props)
			hash = ""
		}
	} else {

		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
			c.Err = model.NewAppError("signupTeamComplete", "The signup link does not appear to be valid", "")
			return
		}

		props = model.MapFromJson(strings.NewReader(data))

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hour
			c.Err = model.NewAppError("signupTeamComplete", "The signup link has expired", "")
			return
		}
	}

	page := NewHtmlTemplatePage("signup_user_complete", "Complete User Sign Up")
	page.Props["Email"] = props["email"]
	page.Props["TeamDisplayName"] = props["display_name"]
	page.Props["TeamName"] = props["name"]
	page.Props["TeamId"] = props["id"]
	page.Props["Data"] = data
	page.Props["Hash"] = hash
	page.Render(c, w)
}

func logout(c *api.Context, w http.ResponseWriter, r *http.Request) {
	api.Logout(c, w, r)
	http.Redirect(w, r, c.GetTeamURL(), http.StatusFound)
}

func getChannel(c *api.Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	name := params["channelname"]

	var channelId string
	if result := <-api.Srv.Store.Channel().CheckPermissionsToByName(c.Session.TeamId, name, c.Session.UserId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		channelId = result.Data.(string)
	}

	if len(channelId) == 0 {
		if strings.Index(name, "__") > 0 {
			// It's a direct message channel that doesn't exist yet so let's create it
			ids := strings.Split(name, "__")
			otherUserId := ""
			if ids[0] == c.Session.UserId {
				otherUserId = ids[1]
			} else {
				otherUserId = ids[0]
			}

			if sc, err := api.CreateDirectChannel(c, otherUserId); err != nil {
				api.Handle404(w, r)
				return
			} else {
				channelId = sc.Id
			}
		} else {

			// lets make sure the user is valid
			if result := <-api.Srv.Store.User().Get(c.Session.UserId); result.Err != nil {
				c.Err = result.Err
				c.RemoveSessionCookie(w)
				l4g.Error("Error in getting users profile for id=%v forcing logout", c.Session.UserId)
				return
			}

			//api.Handle404(w, r)
			//Bad channel urls just redirect to the town-square for now

			http.Redirect(w, r, c.GetTeamURL()+"/channels/town-square", http.StatusFound)
			return
		}
	}

	var team *model.Team

	if tResult := <-api.Srv.Store.Team().Get(c.Session.TeamId); tResult.Err != nil {
		c.Err = tResult.Err
		return
	} else {
		team = tResult.Data.(*model.Team)
	}

	page := NewHtmlTemplatePage("channel", "")
	page.Props["Title"] = name + " - " + team.DisplayName + " " + page.ClientProps["SiteName"]
	page.Props["TeamDisplayName"] = team.DisplayName
	page.Props["TeamType"] = team.Type
	page.Props["TeamId"] = team.Id
	page.Props["ChannelName"] = name
	page.Props["ChannelId"] = channelId
	page.Props["UserId"] = c.Session.UserId
	page.Render(c, w)
}

func verifyEmail(c *api.Context, w http.ResponseWriter, r *http.Request) {
	resend := r.URL.Query().Get("resend")
	resendSuccess := r.URL.Query().Get("resend_success")
	name := r.URL.Query().Get("teamname")
	email := r.URL.Query().Get("email")
	hashedId := r.URL.Query().Get("hid")
	userId := r.URL.Query().Get("uid")

	var team *model.Team
	if result := <-api.Srv.Store.Team().GetByName(name); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	if resend == "true" {
		if result := <-api.Srv.Store.User().GetByEmail(team.Id, email); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			user := result.Data.(*model.User)
			api.FireAndForgetVerifyEmail(user.Id, user.Email, team.Name, team.DisplayName, c.GetSiteURL(), c.GetTeamURLFromTeam(team))

			newAddress := strings.Replace(r.URL.String(), "&resend=true", "&resend_success=true", -1)
			http.Redirect(w, r, newAddress, http.StatusFound)
			return
		}
	}

	var isVerified string
	if len(userId) != 26 {
		isVerified = "false"
	} else if len(hashedId) == 0 {
		isVerified = "false"
	} else if model.ComparePassword(hashedId, userId) {
		isVerified = "true"
		if c.Err = (<-api.Srv.Store.User().VerifyEmail(userId)).Err; c.Err != nil {
			return
		} else {
			c.LogAudit("")
		}
	} else {
		isVerified = "false"
	}

	page := NewHtmlTemplatePage("verify", "Email Verified")
	page.Props["IsVerified"] = isVerified
	page.Props["TeamURL"] = c.GetTeamURLFromTeam(team)
	page.Props["UserEmail"] = email
	page.Props["ResendSuccess"] = resendSuccess
	page.Render(c, w)
}

func verifyNewEmail(c *api.Context, w http.ResponseWriter, r *http.Request) {
	hashedId := r.URL.Query().Get("hid")
	userId := r.URL.Query().Get("uid")
	oldEmail := r.URL.Query().Get("old_email")
	newEmail := r.URL.Query().Get("new_email")
	teamName := r.URL.Query().Get("teamname")

	var team *model.Team
	if result := <-api.Srv.Store.Team().GetByName(teamName); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var isVerified string
	if result := <-api.Srv.Store.User().GetByEmail(team.Id, oldEmail); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user := result.Data.(*model.User)

		if user.Email == user.TempEmail || user.TempEmail != newEmail {
			isVerified = "false"
		} else if len(userId) != 26 {
			isVerified = "false"
		} else if len(hashedId) == 0 {
			isVerified = "false"
		} else if model.ComparePassword(hashedId, userId) {
			isVerified = "true"
			if c.Err = (<-api.Srv.Store.User().UpdateEmail(userId)).Err; c.Err != nil {
				return
			} else {
				c.LogAudit("")
			}
		} else {
			isVerified = "false"
		}
	}

	if isVerified == "true" {
		var team *model.Team
		if result := <-api.Srv.Store.Team().GetByName(teamName); result.Err != nil {
			c.Err = result.Err
		} else {
			team = result.Data.(*model.Team)
			api.FireAndForgetEmailChangeEmail(oldEmail, team.DisplayName, c.GetTeamURLFromTeam(team), c.GetSiteURL())
		}
	}

	page := NewHtmlTemplatePage("new_email_verify", "New Email Verified")
	page.Props["IsVerified"] = isVerified
	page.Render(c, w)
}

func findTeam(c *api.Context, w http.ResponseWriter, r *http.Request) {
	page := NewHtmlTemplatePage("find_team", "Find Team")
	page.Render(c, w)
}

func resetPassword(c *api.Context, w http.ResponseWriter, r *http.Request) {
	isResetLink := true
	hash := r.URL.Query().Get("h")
	data := r.URL.Query().Get("d")
	params := mux.Vars(r)
	teamName := params["team"]

	if len(hash) == 0 || len(data) == 0 {
		isResetLink = false
	} else {
		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.PasswordResetSalt)) {
			c.Err = model.NewAppError("resetPassword", "The reset link does not appear to be valid", "")
			return
		}

		props := model.MapFromJson(strings.NewReader(data))

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60 { // one hour
			c.Err = model.NewAppError("resetPassword", "The signup link has expired", "")
			return
		}
	}

	teamDisplayName := "Developer/Beta"
	var team *model.Team
	if tResult := <-api.Srv.Store.Team().GetByName(teamName); tResult.Err != nil {
		c.Err = tResult.Err
		return
	} else {
		team = tResult.Data.(*model.Team)
	}

	if team != nil {
		teamDisplayName = team.DisplayName
	}

	page := NewHtmlTemplatePage("password_reset", "")
	page.Props["Title"] = "Reset Password " + page.ClientProps["SiteName"]
	page.Props["TeamDisplayName"] = teamDisplayName
	page.Props["Hash"] = hash
	page.Props["Data"] = data
	page.Props["TeamName"] = teamName
	page.Props["IsReset"] = strconv.FormatBool(isResetLink)
	page.Render(c, w)
}

func signupWithOAuth(c *api.Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]
	teamName := params["team"]

	if len(teamName) == 0 {
		c.Err = model.NewAppError("signupWithOAuth", "Invalid team name", "team_name="+teamName)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	hash := r.URL.Query().Get("h")

	var team *model.Team
	if result := <-api.Srv.Store.Team().GetByName(teamName); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	if api.IsVerifyHashRequired(nil, team, hash) {
		data := r.URL.Query().Get("d")
		props := model.MapFromJson(strings.NewReader(data))

		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
			c.Err = model.NewAppError("signupWithOAuth", "The signup link does not appear to be valid", "")
			return
		}

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hours
			c.Err = model.NewAppError("signupWithOAuth", "The signup link has expired", "")
			return
		}

		if team.Id != props["id"] {
			c.Err = model.NewAppError("signupWithOAuth", "Invalid team name", data)
			return
		}
	}

	redirectUri := c.GetSiteURL() + "/signup/" + service + "/complete"

	api.GetAuthorizationCode(c, w, r, teamName, service, redirectUri, "")
}

func signupCompleteOAuth(c *api.Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	uri := c.GetSiteURL() + "/signup/" + service + "/complete"

	if body, team, err := api.AuthorizeOAuthUser(service, code, state, uri); err != nil {
		c.Err = err
		return
	} else {
		var user *model.User
		if service == model.USER_AUTH_SERVICE_GITLAB {
			glu := model.GitLabUserFromJson(body)
			user = model.UserFromGitLabUser(glu)
		}

		if user == nil {
			c.Err = model.NewAppError("signupCompleteOAuth", "Could not create user out of "+service+" user object", "")
			return
		}

		suchan := api.Srv.Store.User().GetByAuth(team.Id, user.AuthData, service)
		euchan := api.Srv.Store.User().GetByEmail(team.Id, user.Email)

		if team.Email == "" {
			team.Email = user.Email
			if result := <-api.Srv.Store.Team().Update(team); result.Err != nil {
				c.Err = result.Err
				return
			}
		} else {
			found := true
			count := 0
			for found {
				if found = api.IsUsernameTaken(user.Username, team.Id); c.Err != nil {
					return
				} else if found {
					user.Username = user.Username + strconv.Itoa(count)
					count += 1
				}
			}
		}

		if result := <-suchan; result.Err == nil {
			c.Err = model.NewAppError("signupCompleteOAuth", "This "+service+" account has already been used to sign up for team "+team.DisplayName, "email="+user.Email)
			return
		}

		if result := <-euchan; result.Err == nil {
			c.Err = model.NewAppError("signupCompleteOAuth", "Team "+team.DisplayName+" already has a user with the email address attached to your "+service+" account", "email="+user.Email)
			return
		}

		user.TeamId = team.Id
		user.EmailVerified = true

		ruser := api.CreateUser(c, team, user)
		if c.Err != nil {
			return
		}

		api.Login(c, w, r, ruser, "")

		if c.Err != nil {
			return
		}

		root(c, w, r)
	}
}

func loginWithOAuth(c *api.Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]
	teamName := params["team"]
	loginHint := r.URL.Query().Get("login_hint")

	if len(teamName) == 0 {
		c.Err = model.NewAppError("loginWithOAuth", "Invalid team name", "team_name="+teamName)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	// Make sure team exists
	if result := <-api.Srv.Store.Team().GetByName(teamName); result.Err != nil {
		c.Err = result.Err
		return
	}

	redirectUri := c.GetSiteURL() + "/login/" + service + "/complete"

	api.GetAuthorizationCode(c, w, r, teamName, service, redirectUri, loginHint)
}

func loginCompleteOAuth(c *api.Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	uri := c.GetSiteURL() + "/login/" + service + "/complete"

	if body, team, err := api.AuthorizeOAuthUser(service, code, state, uri); err != nil {
		c.Err = err
		return
	} else {
		authData := ""
		if service == model.USER_AUTH_SERVICE_GITLAB {
			glu := model.GitLabUserFromJson(body)
			authData = glu.GetAuthData()
		}

		if len(authData) == 0 {
			c.Err = model.NewAppError("loginCompleteOAuth", "Could not parse auth data out of "+service+" user object", "")
			return
		}

		var user *model.User
		if result := <-api.Srv.Store.User().GetByAuth(team.Id, authData, service); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			user = result.Data.(*model.User)
			api.Login(c, w, r, user, "")

			if c.Err != nil {
				return
			}

			root(c, w, r)
		}
	}
}

func adminConsole(c *api.Context, w http.ResponseWriter, r *http.Request) {

	if !c.HasSystemAdminPermissions("adminConsole") {
		return
	}

	page := NewHtmlTemplatePage("admin_console", "Admin Console")
	page.Render(c, w)
}

func authorizeOAuth(c *api.Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewAppError("authorizeOAuth", "The system admin has turned off OAuth service providing.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if !CheckBrowserCompatability(c, r) {
		return
	}

	responseType := r.URL.Query().Get("response_type")
	clientId := r.URL.Query().Get("client_id")
	redirect := r.URL.Query().Get("redirect_uri")
	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	if len(responseType) == 0 || len(clientId) == 0 || len(redirect) == 0 {
		c.Err = model.NewAppError("authorizeOAuth", "Missing one or more of response_type, client_id, or redirect_uri", "")
		return
	}

	var app *model.OAuthApp
	if result := <-api.Srv.Store.OAuth().GetApp(clientId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		app = result.Data.(*model.OAuthApp)
	}

	var team *model.Team
	if result := <-api.Srv.Store.Team().Get(c.Session.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	page := NewHtmlTemplatePage("authorize", "Authorize Application")
	page.Props["TeamName"] = team.Name
	page.Props["AppName"] = app.Name
	page.Props["ResponseType"] = responseType
	page.Props["ClientId"] = clientId
	page.Props["RedirectUri"] = redirect
	page.Props["Scope"] = scope
	page.Props["State"] = state
	page.Render(c, w)
}

func getAccessToken(c *api.Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewAppError("getAccessToken", "The system admin has turned off OAuth service providing.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	c.LogAudit("attempt")

	r.ParseForm()

	grantType := r.FormValue("grant_type")
	if grantType != model.ACCESS_TOKEN_GRANT_TYPE {
		c.Err = model.NewAppError("getAccessToken", "invalid_request: Bad grant_type", "")
		return
	}

	clientId := r.FormValue("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewAppError("getAccessToken", "invalid_request: Bad client_id", "")
		return
	}

	secret := r.FormValue("client_secret")
	if len(secret) == 0 {
		c.Err = model.NewAppError("getAccessToken", "invalid_request: Missing client_secret", "")
		return
	}

	code := r.FormValue("code")
	if len(code) == 0 {
		c.Err = model.NewAppError("getAccessToken", "invalid_request: Missing code", "")
		return
	}

	redirectUri := r.FormValue("redirect_uri")

	achan := api.Srv.Store.OAuth().GetApp(clientId)
	tchan := api.Srv.Store.OAuth().GetAccessDataByAuthCode(code)

	authData := api.GetAuthData(code)

	if authData == nil {
		c.LogAudit("fail - invalid auth code")
		c.Err = model.NewAppError("getAccessToken", "invalid_grant: Invalid or expired authorization code", "")
		return
	}

	uchan := api.Srv.Store.User().Get(authData.UserId)

	if authData.IsExpired() {
		c.LogAudit("fail - auth code expired")
		c.Err = model.NewAppError("getAccessToken", "invalid_grant: Invalid or expired authorization code", "")
		return
	}

	if authData.RedirectUri != redirectUri {
		c.LogAudit("fail - redirect uri provided did not match previous redirect uri")
		c.Err = model.NewAppError("getAccessToken", "invalid_request: Supplied redirect_uri does not match authorization code redirect_uri", "")
		return
	}

	if !model.ComparePassword(code, fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, authData.UserId)) {
		c.LogAudit("fail - auth code is invalid")
		c.Err = model.NewAppError("getAccessToken", "invalid_grant: Invalid or expired authorization code", "")
		return
	}

	var app *model.OAuthApp
	if result := <-achan; result.Err != nil {
		c.Err = model.NewAppError("getAccessToken", "invalid_client: Invalid client credentials", "")
		return
	} else {
		app = result.Data.(*model.OAuthApp)
	}

	if !model.ComparePassword(app.ClientSecret, secret) {
		c.LogAudit("fail - invalid client credentials")
		c.Err = model.NewAppError("getAccessToken", "invalid_client: Invalid client credentials", "")
		return
	}

	callback := redirectUri
	if len(callback) == 0 {
		callback = app.CallbackUrls[0]
	}

	if result := <-tchan; result.Err != nil {
		c.Err = model.NewAppError("getAccessToken", "server_error: Encountered internal server error while accessing database", "")
		return
	} else if result.Data != nil {
		c.LogAudit("fail - auth code has been used previously")
		accessData := result.Data.(*model.AccessData)

		// Revoke access token, related auth code, and session from DB as well as from cache
		if err := api.RevokeAccessToken(accessData.Token); err != nil {
			l4g.Error("Encountered an error revoking an access token, err=" + err.Message)
		}

		c.Err = model.NewAppError("getAccessToken", "invalid_grant: Authorization code already exchanged for an access token", "")
		return
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = model.NewAppError("getAccessToken", "server_error: Encountered internal server error while pulling user from database", "")
		return
	} else {
		user = result.Data.(*model.User)
	}

	session := &model.Session{UserId: user.Id, TeamId: user.TeamId, Roles: user.Roles, IsOAuth: true}

	if result := <-api.Srv.Store.Session().Save(session); result.Err != nil {
		c.Err = model.NewAppError("getAccessToken", "server_error: Encountered internal server error while saving session to database", "")
		return
	} else {
		session = result.Data.(*model.Session)
		api.AddSessionToCache(session)
	}

	accessData := &model.AccessData{AuthCode: authData.Code, Token: session.Token, RedirectUri: callback}

	if result := <-api.Srv.Store.OAuth().SaveAccessData(accessData); result.Err != nil {
		l4g.Error(result.Err)
		c.Err = model.NewAppError("getAccessToken", "server_error: Encountered internal server error while saving access token to database", "")
		return
	}

	accessRsp := &model.AccessResponse{AccessToken: session.Token, TokenType: model.ACCESS_TOKEN_TYPE, ExpiresIn: model.SESSION_TIME_OAUTH_IN_SECS}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	c.LogAuditWithUserId(user.Id, "success")

	w.Write([]byte(accessRsp.ToJson()))
}

func incomingWebhook(c *api.Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	hchan := api.Srv.Store.Webhook().GetIncoming(id)

	r.ParseForm()

	var props map[string]string
	if r.Header.Get("Content-Type") == "application/json" {
		props = model.MapFromJson(r.Body)
	} else {
		props = model.MapFromJson(strings.NewReader(r.FormValue("payload")))
	}

	text := props["text"]
	if len(text) == 0 {
		c.Err = model.NewAppError("incomingWebhook", "No text specified", "")
		return
	}

	channelName := props["channel"]

	var hook *model.IncomingWebhook
	if result := <-hchan; result.Err != nil {
		c.Err = model.NewAppError("incomingWebhook", "Invalid webhook", "err="+result.Err.Message)
		return
	} else {
		hook = result.Data.(*model.IncomingWebhook)
	}

	var channel *model.Channel
	var cchan store.StoreChannel

	if len(channelName) != 0 {
		if channelName[0] == '@' {
			if result := <-api.Srv.Store.User().GetByUsername(hook.TeamId, channelName[1:]); result.Err != nil {
				c.Err = model.NewAppError("incomingWebhook", "Couldn't find the user", "err="+result.Err.Message)
				return
			} else {
				channelName = model.GetDMNameFromIds(result.Data.(*model.User).Id, hook.UserId)
			}
		} else if channelName[0] == '#' {
			channelName = channelName[1:]
		}

		cchan = api.Srv.Store.Channel().GetByName(hook.TeamId, channelName)
	} else {
		cchan = api.Srv.Store.Channel().Get(hook.ChannelId)
	}

	// parse links into Markdown format
	linkWithTextRegex := regexp.MustCompile(`<([^<\|]+)\|([^>]+)>`)
	text = linkWithTextRegex.ReplaceAllString(text, "[${2}](${1})")

	linkRegex := regexp.MustCompile(`<\s*(\S*)\s*>`)
	text = linkRegex.ReplaceAllString(text, "${1}")

	if result := <-cchan; result.Err != nil {
		c.Err = model.NewAppError("incomingWebhook", "Couldn't find the channel", "err="+result.Err.Message)
		return
	} else {
		channel = result.Data.(*model.Channel)
	}

	pchan := api.Srv.Store.Channel().CheckPermissionsTo(hook.TeamId, channel.Id, hook.UserId)

	post := &model.Post{UserId: hook.UserId, ChannelId: channel.Id, Message: text}

	if !c.HasPermissionsToChannel(pchan, "createIncomingHook") && channel.Type != model.CHANNEL_OPEN {
		c.Err = model.NewAppError("incomingWebhook", "Inappropriate channel permissions", "")
		return
	}

	// create a mock session
	c.Session = model.Session{UserId: hook.UserId, TeamId: hook.TeamId, IsOAuth: false}

	if _, err := api.CreatePost(c, post, false); err != nil {
		c.Err = model.NewAppError("incomingWebhook", "Error creating post", "err="+err.Message)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("ok"))
}
