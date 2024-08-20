const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  profilePicture: {
    type: String,
    default: ''
  },
  folderIds: {
    type: [String],
    default: []
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save',async function(next){
    if(this.isModified('password') || this.new){
        try{
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password,salt);
            next();
        }catch(err){
            next(err);
        }
    }else{
        next();
    }
});

userSchema.methods.comparePassword = function(candidatePassword){
    return bcrypt.compare(candidatePassword,this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;