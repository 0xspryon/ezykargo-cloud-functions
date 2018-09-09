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
class Trucks {
}
Trucks.bucketPath = "/bucket/trucksList/";
Trucks.basePath = `${Trucks.bucketPath}trucks/`;
Trucks.getRef = (id) => {
    return `${Trucks.basePath}${id}`;
};
Trucks.getDoc = (id) => __awaiter(this, void 0, void 0, function* () {
    return admin.firestore().doc(Trucks.getRef(id)).get();
});
Trucks.isValidTruck = (truck) => {
    return true;
};
Trucks.isValidTechnicalVisit = (tv) => {
    return true;
};
Trucks.isValidInsurrance = (insurrance) => {
    return true;
};
exports.Trucks = Trucks;
//# sourceMappingURL=trucks.js.map