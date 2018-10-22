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
class Users {
}
Users.basePath = "/bucket/usersList/users/";
Users.getRef = (uid) => {
    return `${Users.basePath}${uid}`;
};
Users.getDocByRef = (ref) => __awaiter(this, void 0, void 0, function* () {
    return admin.firestore().doc(ref).get();
});
Users.getDoc = (uid) => __awaiter(this, void 0, void 0, function* () {
    return admin.firestore().doc(Users.getRef(uid)).get();
});
Users.refExsits = (userRef) => __awaiter(this, void 0, void 0, function* () {
    const dataSnapshot = yield admin.firestore().doc(userRef).get();
    const result = dataSnapshot.exists;
    if (result)
        Users.user = dataSnapshot.data();
    return result;
});
exports.Users = Users;
//# sourceMappingURL=users.js.map