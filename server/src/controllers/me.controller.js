const BaseRestController = require('./base-rest.controller');
const ValidationData = require('../helper/validationIncomingData');
const UserModel = require('../models/user.model');
const MailSender = require("../helper/mailSender");
const crypto = require('crypto');
const PasswordHasher = require('../helper/passwordHasher');

/**
 * Profile controller
 */
class MeController extends BaseRestController {

  /**
   * Register controller routes
   */
  registerRoutes() {
    this.router.put('/:id/update_password', this.updatePassword.bind(this))
    this.router.get('/forgot_password', this.forgotPassword.bind(this))
    this.router.put('/reset_password', this.resetPassword.bind(this))
  }

  /**
   * Update password
   * @param {request} req
   * @param {response} res
   */
  updatePassword(req, res) {

    var fieldToValidate = ["id"];
    var errorMessage = "";
    var userId = "";

    console.log("update");
    if (req.body.hasOwnProperty('id')) {
      errorMessage = ValidationData(fieldToValidate, req.body);
      userId = req.body.id;
    }
    else {
      errorMessage = ValidationData(fieldToValidate, req.params);
      userId = req.params.id;
    }

    //check passwords are equal
    if (req.body.password !== req.body.password_confirmation) {
      errorMessage += "Passwords doesn't match";
    }

    if (errorMessage != "") {
      this._error(res, errorMessage, 500)
      return;
    }

    //create auxiliar user
    var userNewData = { 'password': `${req.body.password}` };
    userNewData.password = PasswordHasher.hashPassword(req.body.password);

    //update
    UserModel.findByIdAndUpdate(userId, userNewData, (error, user) => {

      if (error) {
        this._error(res, "Failed to update user's password.", 500);
        return;
      }
      res.status(204).end();
    });
  }

  /**
   * Forgot password
   * @param {request} req
   * @param {response} res
   */
  forgotPassword(req, res) {

    var fieldToValidate = ["email"];
    var errorMessage = ValidationData(fieldToValidate, req.query);

    if(errorMessage != "") {
      this._error(res,errorMessage);
    }

    crypto.randomBytes(20, function(err, buffer) {

      var token = buffer.toString('hex');

      //86400000 ms = 24hs
      UserModel.findOneAndUpdate({ email: req.query.email },  { reset_password_token: token, reset_password_expires: Date.now() + 60 * 60 * 24 * 1000 }, (err, user) => {

        if(err) {
          this._error(res, "User not found");
        }

        //this URL must be a front-end URL. For testing purposes, I'm sending the id and the token which can be used to reset the password
        var resetPasswordURL= 'http://localhost:3000/api/users/reset_password/ ID: ' + user._id +" Token: " + "-" +  token + "-";

        errorMessage= MailSender.mailSender(
          [`${user.name} ${user.surname} ${user.email}`],
          'resetPassword',
          {
            name: user.name,
            resetPasswordURL: resetPasswordURL
          }
        );

          if (errorMessage){
            this._error(res, errorMessage);
          }

          let response = {
            status: 200,
            errorInfo: "",
            data: {
              message: "An email was sent to the account you provided"
            }
          }

          res.status(200).json(response).end();

        });
      });

  }

  resetPassword(req, res){

    var fieldToValidate = ["id", "token", "password", "password_confirmation"];
    var errorMessage = ValidationData(fieldToValidate, req.body);

    if(errorMessage != "") {
      this._error(res,errorMessage);
    }

    UserModel.findByIdAndUpdate(req.body.id , {reset_password_expires: undefined, reset_password_token: undefined}, (error, user) => {
      if(error) {
        this._error(res,"User not found");
      }
      else if (req.body.token !== user.reset_password_token){
        this._error(res,"Invalid token");
      }
      else if (user.reset_password_expires < Date.now()){
        this._error(res,"Expired token");
      }

      else{
        updateUserPassword(req,res);
      }
    })
  }
}

module.exports = MeController;