const debug = require("debug")("signalk:cloud-server");
const util = require("util");
const _ = require('lodash');

const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
 
module.exports = function(app) {
  var plugin = {};

  plugin.id = "signalk-cloud-server";
  plugin.name = "SignalK Cloud Server";
  plugin.description = "Plugin use in a signalk k cloud server";

  plugin.start = function(theOptions) {
    debug("start");

    options = theOptions;

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

      app.get('/cloud/facebook', passport.authenticate('facebook', {scope:"email"}));
      app.get('/cloud/facebook/callback',
              passport.authenticate('facebook', 
                                    { successRedirect: '/cloud/getToken',
                                      failureRedirect: '/cloudlogin' }));
    }
    passport.initialize();
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
      }
    }
  };

  return plugin;
};
