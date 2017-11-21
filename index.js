const debug = require("debug")("signalk:cloud-server");
const util = require("util");
const _ = require('lodash');

const express = require('express')
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

 
module.exports = function(app) {
  var plugin = {};

  plugin.id = "signalk-cloud-server";
  plugin.name = "SignalK Cloud Server";
  plugin.description = "Plugin use in a signalk k cloud server";

  plugin.start = function(theOptions) {
    debug("start");

    options = theOptions;

    var cloudApp = express();

    cloudApp.use(require('cookie-parser')());
    cloudApp.use(require('body-parser').urlencoded({ extended: true }));
    cloudApp.use(require('express-session')({ 
      secret: 'cloudsecret',
      saveUninitialized: true,
      resave: true
    }))
    
    cloudApp.use(passport.initialize());
    cloudApp.use(passport.session());

    app.use("/cloud", cloudApp)

    passport.serializeUser(function(user, done) {
      done(null, user.email);
    });
    
    passport.deserializeUser(function(id, done) {
      done(null, { email: id });
    });

    if ( options.facebook_app_id ) {
      debug("Setting up for facebook...")
      passport.use(new FacebookStrategy({
        clientID: options.facebook_app_id,
        clientSecret: options.facebook_app_secret,
        callbackURL: options.facebook_callback,
        profileFields:['id','displayName','emails']
      }, function(accessToken, refreshToken, profile, done) {
        console.log(profile);
        
        var user = { "email": profile.emails[0].value,
                     "name": profile.displayName }
        
        debug("user: " + user.email)
        debug("name: " + user.name)

        done(null, user);
      }));

      cloudApp.get('/facebook', passport.authenticate('facebook', {scope:"email"}));
      cloudApp.get('/facebook/callback',
                   passport.authenticate('facebook', 
                                         { successRedirect: '/cloud/getToken',
                                           failureRedirect: '/cloudlogin' }));
    }

    if ( options.google_client_id ) {
      debug("Setting up for google...")
      passport.use(new GoogleStrategy({
        clientID: options.google_client_id,
        clientSecret: options.google_client_secret,
        callbackURL: options.google_callback
      }, function(accessToken, refreshToken, profile, done) {
        console.log(profile);
        
        var user = { "email": profile.emails[0].value,
                     "name": profile.displayName }
        
        debug("user: " + user.email)
        debug("name: " + user.name)

        done(null, user);
      }));

      cloudApp.get('/google', passport.authenticate('google', { scope : ['profile', 'email'] }));
      cloudApp.get('/google/callback',
                   passport.authenticate('google', 
                                         { successRedirect: '/cloud/getToken',
                                           failureRedirect: '/' }));
    }
      

    cloudApp.get("/getToken", function(req, res) {
      res.send("Yeah: " + JSON.stringify(req.user));
    });
     

  };
  
  plugin.stop = function() {
    debug("stopping...")
  };

  plugin.schema = {
    type: 'object',
    properties: {
      facebook_app_id: {
        type: 'string',
        title: 'Facebook App ID',
      },
      facebook_app_secret: {
        type: 'string',
        title: 'Facebook App Secret',
      },
      facebook_callback: {
        type: 'string',
        title: "Facebook Callback",
        default: "http://localhost/cloud/facebook/callback"
      },
      google_client_id: {
        type: 'string',
        title: 'Google Client ID',
      },
      google_client_secret: {
        type: 'string',
        title: 'Google Client Secret',
      },
      google_callback: {
        type: 'string',
        title: "Google Callback",
        default: "http://localhost/cloud/google/callback"
      }
    }
  };

  return plugin;
};
