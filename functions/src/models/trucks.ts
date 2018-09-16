import * as admin from 'firebase-admin';
import {Users} from "./users";

export class Trucks {
    
    static bucketPath: string = "/bucket/trucksList/";
    static basePath: string = `${Trucks.bucketPath}trucks/`;

    static getRef = (id) =>{
        return `${Trucks.basePath}${id}`
    }

    static getDocByRef = async (ref)=>{
        return admin.firestore().doc(ref).get()
    }
    static getDoc = async (id)=>{
        return admin.firestore().doc(Trucks.getRef(id)).get()
    }

    static isValidTruck= async (truck) =>{
        if(truck.driverRef!=="N/A")
            if(! await Users.refExsits(truck.driverRef))
                return 404
        return true
    }

    static isValidTechnicalVisit= (tv) =>{
        return true
    }

    static isValidInsurrance= (insurrance) =>{
        return true
    }
}