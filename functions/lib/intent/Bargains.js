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
const functions = require("firebase-functions");
const models_1 = require("../models");
const util_1 = require("util");
class BargainsIntent {
}
BargainsIntent.listenAddBargainerOnRTDB = functions.database.ref('bargain/{freightageRef}/participants/{userRef}')
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    const firestore = admin.firestore();
    const freightageRef = context.params.freightageRef;
    const userRef = context.params.userRef;
    firestore.doc(models_1.Freightages.getRef(freightageRef)).get()
        .then(freightageDataSnapshot => {
        const freightageData = freightageDataSnapshot.data();
        let bargainers = [];
        if (freightageData.bargainers && util_1.isArray(freightageData.bargainers)) {
            bargainers = freightageData.bargainers;
        }
        bargainers.push(userRef);
        freightageDataSnapshot.ref.set({
            bargainers: bargainers
        }, { merge: true })
            .catch((onrejected) => {
            console.log("Reject 2", onrejected);
        });
    })
        .catch((onrejected) => {
        console.log("Reject", onrejected);
    });
}));
exports.BargainsIntent = BargainsIntent;
//# sourceMappingURL=Bargains.js.map