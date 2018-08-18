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
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const intent_1 = require("./intent");
//inititalize firebase admin
admin.initializeApp(functions.config().firebase);
// trigger when user singup complete
exports.onSignUpComplete = functions.database.ref('/intents/sign_up/{auuid}/finished')
    .onUpdate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    return intent_1.Auth.signUp(snapshot, context);
}));
//# sourceMappingURL=index.js.map