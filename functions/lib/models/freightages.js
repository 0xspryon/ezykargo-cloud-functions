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
class Freightages {
}
Freightages.bucketPath = "/bucket/freightagesList/";
Freightages.basePath = `${Freightages.bucketPath}freightages/`;
Freightages.getRef = (id) => {
    return `${Freightages.basePath}${id}`;
};
Freightages.getDocByRef = (ref) => __awaiter(this, void 0, void 0, function* () {
    return admin.firestore().doc(ref).get();
});
Freightages.getDoc = (id) => __awaiter(this, void 0, void 0, function* () {
    return admin.firestore().doc(Freightages.getRef(id)).get();
});
Freightages.isValidFreightage = (freightage) => __awaiter(this, void 0, void 0, function* () {
    return true;
});
exports.Freightages = Freightages;
//# sourceMappingURL=freightages.js.map