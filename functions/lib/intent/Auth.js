"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const File_1 = require("../utils/File");
const FieldValue = require('firebase-admin').firestore.FieldValue;
class Auth {
}
Auth.signUp = (change, context) => __awaiter(this, void 0, void 0, function* () {
    const snapshot = change.after;
    console.log("SIGN UP CALL: " + context.params.auuid);
    if (!snapshot.val())
        return false;
    const auuid = context.params.auuid;
    //create news users into firestore and link it with realtime database
    const userDataSnapshot = yield admin.database().ref(`/intents/sign_up/${auuid}`).once('value');
    console.log(userDataSnapshot);
    //move images to correct bucket
    const promises = [];
    const nic_front_path = userDataSnapshot.val().NIC_FRONT_JPG.path;
    const nic_back_path = userDataSnapshot.val().NIC_BACK_JPG.path;
    const profile_path = userDataSnapshot.val().PROFILE_JPG.path;
    const NIC_FRONT_PATH = `/users/nic/${auuid}/${nic_front_path.split("/").pop()}`;
    const NIC_BACK_JPG_PATH = `/users/nic/${auuid}/${nic_back_path.split("/").pop()}`;
    const PROFILE_JPG_PATH = `/users/avatar/${auuid}/${profile_path.split("/").pop()}`;
    promises.push(File_1.File.moveFileFromTo(nic_front_path, NIC_FRONT_PATH));
    promises.push(File_1.File.moveFileFromTo(nic_back_path, NIC_BACK_JPG_PATH));
    promises.push(File_1.File.moveFileFromTo(profile_path, PROFILE_JPG_PATH));
    yield Promise.all(promises);
    //create new user doc to store into firestore
    const userDoc = {
        fullName: userDataSnapshot.val().user_info.fullName,
        firstName: userDataSnapshot.val().user_info.firstName,
        nicNumber: userDataSnapshot.val().user_info.nic_number,
        nicFrontUrl: NIC_FRONT_PATH,
        nicBackUrl: NIC_BACK_JPG_PATH,
        avatarUrl: PROFILE_JPG_PATH,
        public: true,
        timestamp: FieldValue.serverTimestamp()
    };
    console.log(userDoc);
    const userRef = yield admin.firestore().collection("/users").add(userDoc);
    yield admin.database().ref(`/users/${auuid}`).set(userRef.id);
    return admin.database().ref(`/intents/sign_up/${auuid}`).remove();
});
exports.Auth = Auth;
//# sourceMappingURL=Auth.js.map