// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	CONN_SECURITY_NONE     = ""
	CONN_SECURITY_TLS      = "TLS"
	CONN_SECURITY_STARTTLS = "STARTTLS"

	IMAGE_DRIVER_LOCAL = "local"
	IMAGE_DRIVER_S3    = "amazons3"

	DATABASE_DRIVER_MYSQL    = "mysql"
	DATABASE_DRIVER_POSTGRES = "postgres"

	SERVICE_GITLAB = "gitlab"
)

type ServiceSettings struct {
	ListenAddress              string
	MaximumLoginAttempts       int
	SegmentDeveloperKey        string
	GoogleDeveloperKey         string
	EnableOAuthServiceProvider bool
	EnableIncomingWebhooks     bool
	EnableOutgoingWebhooks     bool
	EnablePostUsernameOverride bool
	EnablePostIconOverride     bool
	EnableTesting              bool
	EnableSecurityFixAlert     *bool
}

type SSOSettings struct {
	Enable          bool
	Secret          string
	Id              string
	Scope           string
	AuthEndpoint    string
	TokenEndpoint   string
	UserApiEndpoint string
}

type SqlSettings struct {
	DriverName         string
	DataSource         string
	DataSourceReplicas []string
	MaxIdleConns       int
	MaxOpenConns       int
	Trace              bool
	AtRestEncryptKey   string
}

type LogSettings struct {
	EnableConsole bool
	ConsoleLevel  string
	EnableFile    bool
	FileLevel     string
	FileFormat    string
	FileLocation  string
}

type FileSettings struct {
	DriverName              string
	Directory               string
	EnablePublicLink        bool
	PublicLinkSalt          string
	ThumbnailWidth          int
	ThumbnailHeight         int
	PreviewWidth            int
	PreviewHeight           int
	ProfileWidth            int
	ProfileHeight           int
	InitialFont             string
	AmazonS3AccessKeyId     string
	AmazonS3SecretAccessKey string
	AmazonS3Bucket          string
	AmazonS3Region          string
}

type EmailSettings struct {
	EnableSignUpWithEmail    bool
	SendEmailNotifications   bool
	RequireEmailVerification bool
	FeedbackName             string
	FeedbackEmail            string
	EmailAttributionNotice   string
	SMTPUsername             string
	SMTPPassword             string
	SMTPServer               string
	SMTPPort                 string
	ConnectionSecurity       string
	InviteSalt               string
	PasswordResetSalt        string
	SendPushNotifications    *bool
	PushNotificationServer   *string
}

type RateLimitSettings struct {
	EnableRateLimiter bool
	PerSec            int
	MemoryStoreSize   int
	VaryByRemoteAddr  bool
	VaryByHeader      string
}

type PrivacySettings struct {
	ShowEmailAddress bool
	ShowFullName     bool
}

type TeamSettings struct {
	SiteName                  string
	MaxUsersPerTeam           int
	EnableTeamCreation        bool
	EnableUserCreation        bool
	RestrictCreationToDomains string
	RestrictTeamNames         *bool
	EnableTeamListing         *bool
}

type Config struct {
	ServiceSettings   ServiceSettings
	TeamSettings      TeamSettings
	SqlSettings       SqlSettings
	LogSettings       LogSettings
	FileSettings      FileSettings
	EmailSettings     EmailSettings
	RateLimitSettings RateLimitSettings
	PrivacySettings   PrivacySettings
	GitLabSettings    SSOSettings
}

func (o *Config) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *Config) GetSSOService(service string) *SSOSettings {
	if service == SERVICE_GITLAB {
		return &o.GitLabSettings
	}

	return nil
}

func ConfigFromJson(data io.Reader) *Config {
	decoder := json.NewDecoder(data)
	var o Config
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *Config) SetDefaults() {

	if len(o.SqlSettings.AtRestEncryptKey) == 0 {
		o.SqlSettings.AtRestEncryptKey = NewRandomString(32)
	}

	if len(o.FileSettings.PublicLinkSalt) == 0 {
		o.FileSettings.PublicLinkSalt = NewRandomString(32)
	}

	if len(o.EmailSettings.InviteSalt) == 0 {
		o.EmailSettings.InviteSalt = NewRandomString(32)
	}

	if len(o.EmailSettings.PasswordResetSalt) == 0 {
		o.EmailSettings.PasswordResetSalt = NewRandomString(32)
	}

	if o.ServiceSettings.EnableSecurityFixAlert == nil {
		o.ServiceSettings.EnableSecurityFixAlert = new(bool)
		*o.ServiceSettings.EnableSecurityFixAlert = true
	}

	if o.TeamSettings.RestrictTeamNames == nil {
		o.TeamSettings.RestrictTeamNames = new(bool)
		*o.TeamSettings.RestrictTeamNames = true
	}

	if o.TeamSettings.EnableTeamListing == nil {
		o.TeamSettings.EnableTeamListing = new(bool)
		*o.TeamSettings.EnableTeamListing = false
	}

	if o.EmailSettings.SendPushNotifications == nil {
		o.EmailSettings.SendPushNotifications = new(bool)
		*o.EmailSettings.SendPushNotifications = false
	}

	if o.EmailSettings.PushNotificationServer == nil {
		o.EmailSettings.PushNotificationServer = new(string)
		*o.EmailSettings.PushNotificationServer = ""
	}

}

func (o *Config) IsValid() *AppError {

	if o.ServiceSettings.MaximumLoginAttempts <= 0 {
		return NewAppError("Config.IsValid", "Invalid maximum login attempts for service settings.  Must be a positive number.", "")
	}

	if len(o.ServiceSettings.ListenAddress) == 0 {
		return NewAppError("Config.IsValid", "Invalid listen address for service settings Must be set.", "")
	}

	if o.TeamSettings.MaxUsersPerTeam <= 0 {
		return NewAppError("Config.IsValid", "Invalid maximum users per team for team settings.  Must be a positive number.", "")
	}

	if len(o.SqlSettings.AtRestEncryptKey) < 32 {
		return NewAppError("Config.IsValid", "Invalid at rest encrypt key for SQL settings.  Must be 32 chars or more.", "")
	}

	if !(o.SqlSettings.DriverName == DATABASE_DRIVER_MYSQL || o.SqlSettings.DriverName == DATABASE_DRIVER_POSTGRES) {
		return NewAppError("Config.IsValid", "Invalid driver name for SQL settings.  Must be 'mysql' or 'postgres'", "")
	}

	if o.SqlSettings.MaxIdleConns <= 0 {
		return NewAppError("Config.IsValid", "Invalid maximum idle connection for SQL settings.  Must be a positive number.", "")
	}

	if len(o.SqlSettings.DataSource) == 0 {
		return NewAppError("Config.IsValid", "Invalid data source for SQL settings.  Must be set.", "")
	}

	if o.SqlSettings.MaxOpenConns <= 0 {
		return NewAppError("Config.IsValid", "Invalid maximum open connection for SQL settings.  Must be a positive number.", "")
	}

	if !(o.FileSettings.DriverName == IMAGE_DRIVER_LOCAL || o.FileSettings.DriverName == IMAGE_DRIVER_S3) {
		return NewAppError("Config.IsValid", "Invalid driver name for file settings.  Must be 'local' or 'amazons3'", "")
	}

	if o.FileSettings.PreviewHeight < 0 {
		return NewAppError("Config.IsValid", "Invalid preview height for file settings.  Must be a zero or positive number.", "")
	}

	if o.FileSettings.PreviewWidth <= 0 {
		return NewAppError("Config.IsValid", "Invalid preview width for file settings.  Must be a positive number.", "")
	}

	if o.FileSettings.ProfileHeight <= 0 {
		return NewAppError("Config.IsValid", "Invalid profile height for file settings.  Must be a positive number.", "")
	}

	if o.FileSettings.ProfileWidth <= 0 {
		return NewAppError("Config.IsValid", "Invalid profile width for file settings.  Must be a positive number.", "")
	}

	if o.FileSettings.ThumbnailHeight <= 0 {
		return NewAppError("Config.IsValid", "Invalid thumbnail height for file settings.  Must be a positive number.", "")
	}

	if o.FileSettings.ThumbnailHeight <= 0 {
		return NewAppError("Config.IsValid", "Invalid thumbnail width for file settings.  Must be a positive number.", "")
	}

	if len(o.FileSettings.PublicLinkSalt) < 32 {
		return NewAppError("Config.IsValid", "Invalid public link salt for file settings.  Must be 32 chars or more.", "")
	}

	if !(o.EmailSettings.ConnectionSecurity == CONN_SECURITY_NONE || o.EmailSettings.ConnectionSecurity == CONN_SECURITY_TLS || o.EmailSettings.ConnectionSecurity == CONN_SECURITY_STARTTLS) {
		return NewAppError("Config.IsValid", "Invalid connection security for email settings.  Must be '', 'TLS', or 'STARTTLS'", "")
	}

	if len(o.EmailSettings.InviteSalt) < 32 {
		return NewAppError("Config.IsValid", "Invalid invite salt for email settings.  Must be 32 chars or more.", "")
	}

	if len(o.EmailSettings.PasswordResetSalt) < 32 {
		return NewAppError("Config.IsValid", "Invalid password reset salt for email settings.  Must be 32 chars or more.", "")
	}

	if o.RateLimitSettings.MemoryStoreSize <= 0 {
		return NewAppError("Config.IsValid", "Invalid memory store size for rate limit settings.  Must be a positive number", "")
	}

	if o.RateLimitSettings.PerSec <= 0 {
		return NewAppError("Config.IsValid", "Invalid per sec for rate limit settings.  Must be a positive number", "")
	}

	return nil
}

func (me *Config) GetSanitizeOptions() map[string]bool {
	options := map[string]bool{}
	options["fullname"] = me.PrivacySettings.ShowFullName
	options["email"] = me.PrivacySettings.ShowEmailAddress

	return options
}
