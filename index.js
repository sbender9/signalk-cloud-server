const debug = require("debug")("signalk:cloud-server");
const util = require("util");
const _ = require('lodash');
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')

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

    cloudApp.use('/static', express.static(__dirname + '/static'));

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
                                           failureRedirect: '/cloud/login' }));
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
                                           failureRedirect: '/cloud/login' }));
    }
      

    cloudApp.get("/getToken", function(req, res) {
      var payload = {id: req.user.email};
      var expiration = options.tokenExpiration || '1y'
      debug('jwt expiration: ' + expiration)
      var token = jwt.sign(payload, app.config.settings.security.jwtSecretKey, {expiresIn: expiration} );

      debug(`${req.user.email}: ${token}`)
      addUser(req.user.email)
      res.send(`<br>${req.user.email} your token is<br><br>${token}`);
    });

    cloudApp.get("/login", function(req, res) {
      var html = fs.readFileSync(__dirname + '/login.html', {encoding: 'utf8'})
      res.send(html);
    });
  };

  function addUser(email) {
    var config = readJson(app, 'sk-simple-token-security-config')

    debug("config: " + JSON.stringify(config))
    
    var found = false
    config.configuration.users.forEach(user => {
      if ( user.username == email ) {
        found = true;
      }
    });

    if ( found == false ) {
      config.configuration.users.push({"username": email, "type": "readwrite"})
      
      saveJson(app, 'sk-simple-token-security-config', config)
    }
  }
  
  plugin.stop = function() {
    debug("stopping...")
  };

  plugin.schema = {
    type: 'object',
    properties: {
      tokenExpiration: {
        type: 'string',
        title: 'Token expiration time (Exmaples: 60s, 1m, 1h, 1d, 1y)',
        default: '1y'
      },
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

function pathForPluginId(app, id) {
  var dir = app.config.configPath || app.config.appPath
  return path.join(dir, "/plugin-config-data", id + '.json')
}

function readJson(app, id) {
  try
  {
    const path = pathForPluginId(app, id)
    debug("path: " + path)
    const optionsAsString = fs.readFileSync(path, 'utf8');
    try {
      return JSON.parse(optionsAsString)
    } catch (e) {
      console.error("Could not parse JSON options:" + optionsAsString);
      return {}
    }
  } catch (e) {
    debug("Could not find options for plugin " + id + ", returning empty options")
    debug(e.stack)
    return {}
  }
  return JSON.parse()
}

function saveJson(app, id, json)
{
  fs.writeFile(pathForPluginId(app, id), JSON.stringify(json, null, 2))
}
