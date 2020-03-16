const UserModel = require('./user.model');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');
const validator = require('validator');

const ApplicationError = require('./../core/error/ApplicationError');
const InvalidFullNameError = require('./../core/error/InvalidFullNameError');
const WrongEmailFormatError = require('./../core/error/WrongEmailFormatError');
const EmailAlreadyExistsError = require('./../core/error/EmailAlreadyExistsError');
const UsernameAlreadyExistsError = require('./../core/error/UsernameAlreadyExistsError');
const PasswordLengthRequireError = require('./../core/error/PasswordLengthRequireError');
const AuthenticationFailedError = require('./../core/error/AuthenticationFailedError');
const InvalidUsernameError = require('./../core/error/InvalidUsernameError');
const UsernameLengthRequireError = require('./../core/error/UsernameLengthRequireError');

const JWT_KEY = '@Money!Xi@oLin$@Tranvan2@@';

async function generateAuthToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        passwordHash: user.passwordHash
    };

    const token = jwt.sign(payload, JWT_KEY);
    user.tokens = user.tokens.concat({token});
    await user.save()
    return token;
}

async function generateFacebookAuthToken(user) {
    const payload = {
        id: user.id,
        facebookId: user.facebookId
    };

    const token = jwt.sign(payload, JWT_KEY);
    user.tokens = user.tokens.concat({token});
    await user.save()
    return token;
}

async function generateGoogleAuthToken(user) {
    const payload = {
        id: user.id,
        googleId: user.googleId
    };

    const token = jwt.sign(payload, JWT_KEY);
    user.tokens = user.tokens.concat({token});
    await user.save()
    return token;
}

async function addUser(user) {
    if (user.passwordHash !== undefined & user.passwordHash !== '') {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 8);
    }
    
    await user.save();
    switch (user.type) {
        case "FACEBOOK":
            await generateFacebookAuthToken(user);
            break;
        case "GOOGLE":
            await generateGoogleAuthToken(user);
            break;
        default:
            await generateAuthToken(user);
            break;
    }

    return user;
}

const findByCredentials = async (username, passwordHash) => {
    const user = await UserModel.findOne({ username });
 
    if (!user) {
        throw new ApplicationError('Invalid login credentials');
    }
    const isPasswordMatch = await bcrypt.compare(passwordHash, user.passwordHash);
   
    if (!isPasswordMatch) {
        throw new ApplicationError('Invalid login credentials')
    }
    return user
};

module.exports = {
    verifyFbAccount: async (userData, res) => {
        const user = await UserModel.findOne({ facebookId: userData.facebookId }, (err, result) => {
            if (err || !result) {
                console.log(err);
                return err;
            }
            return result;

        });

        if (user !== null && Object.keys(user)) {
            const token = await generateAuthToken(user)
            res.send({ user, token })
        }
        else {
            let newUser = new UserModel(userData);
            await addUser(newUser);
            res.send({ user : newUser, token: newUser.tokens[0].token }) 

        }
    },

    verifyGgAccount: async (userData, res) => {
        const user = await UserModel.findOne({ googleId: userData.googleId }, (err, result) => {
            if (err || !result) {
                console.log(err);
                return err;
            }
            return result;

        });
        
        if (user !== null && Object.keys(user)) {
            const token = await generateAuthToken(user)
            res.send({ user, token })
        }
        else {
            let newUser = new UserModel(userData);
            await addUser(newUser);
            res.send({ user: newUser, token: newUser.tokens[0].token })
        }
    },

    getUsers: async (params, res) => {
        return await UserModel.find(params, (err, result) => {
            if (err || !result) {
                console.log(err);
                res.status(500).send("Database error!");
                return
            }

            res.status(201).send({ status: "ok", data: result });

        });
    },

    signOut: async (req, res) => {
        try {
            req.user.tokens = req.user.tokens.filter((token) => {
                return token.token != req.token
            })
            await req.user.save()
            res.send({ status: 200, message: 'Sign out!'})
        } catch (err) {
            res.status(400).send({ status: "error", value: err.toString() });
        }
    },

    signInWithPassword: async (req, res) => {
        try {
            const data = req.body.data;
            const user = await findByCredentials(data.username, data.passwordHash);
            if (!user) {
                throw new AuthenticationFailedError();
            }
            const token = await generateAuthToken(user)
            res.send({ user, token })
        } catch (err) {
            res.status(400).send(err);
        }
    },

    signUpWithPassword: async (req, res) => {
        try {
            const data = req.body.data;

            // Validate full name
            if (data.fullName.length < 2) {
                throw new InvalidFullNameError()
            }

            // If sign up with email
            const emailInput = data.email;    
            if (emailInput.length && !validator.isEmail(emailInput)) {
                throw new WrongEmailFormatError()
            }
            if (emailInput.length) {                
                const existEmail = await UserModel.find({ email: emailInput });
                
                if (existEmail != undefined && Object.keys(existEmail).length) {                
                    throw new EmailAlreadyExistsError()
                }
            }            

            // If sign up by user name
            const username = data.username;
            
            if (username == undefined || username == '' || /\s/.test(username)) {
                throw new InvalidUsernameError();
            }
            if (username.length < 6) {
                throw new UsernameLengthRequireError();
            }
           
            let existUser = Object.assign({}, await UserModel.find({ username: username }));

            if (existUser != undefined && Object.keys(existUser).length) {
                throw new UsernameAlreadyExistsError();                
            }
            if (data.passwordHash.length < 6) {
                throw new PasswordLengthRequireError()
                
            }
            
            // register normal new user
            data.type = "NORMAL";            

            const newUser = new UserModel(data);
            await addUser(newUser);            

            res.status(201).send({ user: newUser, token: newUser.tokens[0].token });
        } catch (err) {
            res.status(404).send(err);
        }

    },

    updateUser: (id, data, res) => {
        UserModel.findByIdAndUpdate(id, data, { new: true }, (err, result) => {
            if (err) {
                console.log(err);
                res.send(JSON.stringify({ status: "error", value: "Error, db request failed" }));
                return
            }

            res.status(201).send({ status: "ok", data: result });
        });
    }

}