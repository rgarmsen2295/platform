// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/model"
)

var IsLicensed bool = false
var License *model.License = &model.License{}
var ClientLicense map[string]string = make(map[string]string)

// test public key
var publicKey []byte = []byte(`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3/k3Al9q1Xe+xngQ/yGn
0suaJopea3Cpf6NjIHdO8sYTwLlxqt0Mdb+qBR9LbCjZfcNmqc5mZONvsyCEoN/5
VoLdlv1m9ao2BSAWphUxE2CPdUWdLOsDbQWliSc5//UhiYeR+67Xxon0Hg0LKXF6
PumRIWQenRHJWqlUQZ147e7/1v9ySVRZksKpvlmMDzgq+kCH/uyM1uVP3z7YXhlN
K7vSSQYbt4cghvWQxDZFwpLlsChoY+mmzClgq+Yv6FLhj4/lk94twdOZau/AeZFJ
NxpC+5KFhU+xSeeklNqwCgnlOyZ7qSTxmdJHb+60SwuYnnGIYzLJhY4LYDr4J+KR
1wIDAQAB
-----END PUBLIC KEY-----`)

func LoadLicense(licenseBytes []byte) {
	if success, licenseStr := ValidateLicense(licenseBytes); success {
		license := model.LicenseFromJson(strings.NewReader(licenseStr))
		SetLicense(license)
		return
	}

	l4g.Warn(T("utils.license.load_license.invalid.warn"))
}

func SetLicense(license *model.License) bool {
	license.Features.SetDefaults()

	if !license.IsExpired() && license.IsStarted() {
		License = license
		IsLicensed = true
		ClientLicense = getClientLicense(license)
		return true
	}

	return false
}

func RemoveLicense() {
	License = &model.License{}
	IsLicensed = false
	ClientLicense = getClientLicense(License)
}

func ValidateLicense(signed []byte) (bool, string) {
	decoded := make([]byte, base64.StdEncoding.DecodedLen(len(signed)))

	_, err := base64.StdEncoding.Decode(decoded, signed)
	if err != nil {
		l4g.Error(T("utils.license.validate_license.decode.error"), err.Error())
		return false, ""
	}

	if len(decoded) <= 256 {
		l4g.Error(T("utils.license.validate_license.not_long.error"))
		return false, ""
	}

	// remove null terminator
	for decoded[len(decoded)-1] == byte(0) {
		decoded = decoded[:len(decoded)-1]
	}

	plaintext := decoded[:len(decoded)-256]
	signature := decoded[len(decoded)-256:]

	block, _ := pem.Decode(publicKey)

	public, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		l4g.Error(T("utils.license.validate_license.signing.error"), err.Error())
		return false, ""
	}

	rsaPublic := public.(*rsa.PublicKey)

	h := sha512.New()
	h.Write(plaintext)
	d := h.Sum(nil)

	err = rsa.VerifyPKCS1v15(rsaPublic, crypto.SHA512, d, signature)
	if err != nil {
		l4g.Error(T("utils.license.validate_license.invalid.error"), err.Error())
		return false, ""
	}

	return true, string(plaintext)
}

func getClientLicense(l *model.License) map[string]string {
	props := make(map[string]string)

	props["IsLicensed"] = strconv.FormatBool(IsLicensed)

	if IsLicensed {
		props["Users"] = strconv.Itoa(*l.Features.Users)
		props["LDAP"] = strconv.FormatBool(*l.Features.LDAP)
		props["GoogleSSO"] = strconv.FormatBool(*l.Features.GoogleSSO)
		props["IssuedAt"] = strconv.FormatInt(l.IssuedAt, 10)
		props["StartsAt"] = strconv.FormatInt(l.StartsAt, 10)
		props["ExpiresAt"] = strconv.FormatInt(l.ExpiresAt, 10)
		props["Name"] = l.Customer.Name
		props["Email"] = l.Customer.Email
		props["Company"] = l.Customer.Company
		props["PhoneNumber"] = l.Customer.PhoneNumber
	}

	return props
}
