import {FreightagesIntent} from "./Freightages";
const functions = require('firebase-functions');

const request = require('request-promise');

let elasticSearchConfig = functions.config().elasticsearch;
let elasticSearchFreightUrl = (prefix: string, ref_id: string) => elasticSearchConfig.url + `freightage_${prefix}/_doc/` + ref_id;
let elasticSearchMethod = {
    post: 'POST',
    delete: 'DELETE',
    put: 'PUT',
};

export class AnalyticscController {

    static saveFreightageDeclarationToAnalytics = (freightage, ref_id) => {
        const freightageDeclarationPrefix = 'created'

        let body = {
            eventAt: (new Date()).getTime() + 20,
            created: true,
            ref_id,
        }

        let elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightageDeclarationPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            console.log('Ealstsearch freightage declaration', response);
        })

    }

    static saveFreightagePickedUpToAnalytics = (ref_id) => {
        const freightagePickUpPrefix = 'picked_up'

        let body = {
            pickup: true,
            eventAt: (new Date()).getTime() + 20,
            ref_id,
        }

        let elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            console.log('Elasticsearch Freightage pickup', response);
        })
    }

    static saveFreightageDeliveredToAnalytics = (ref_id: string) => {
        const freightagePickUpPrefix = 'delivered'

        let body = {
            delivered: true,
            eventAt: (new Date()).getTime() + 20,
            ref_id,
        }

        let elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            console.log('Elasticsearch Freightage delivered', response);
        })

    }

    static saveFreightageCompletedToAnalytics = (ref_id) => {
        const freightagePickUpPrefix = 'completed'

        let body = {
            completed: true,
            eventAt: (new Date()).getTime() + 20,
            ref_id,
        }

        let elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            console.log('Elasticsearch Freightage completed', response);
        })

    }

    static saveFreightageIdlingToAnalytics = (ref_id) => {
        const freightagePickUpPrefix = 'idling'

        let body = {
            idle: true,
            eventAt: (new Date()).getTime() + 20,
            ref_id,
        }

        let elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            console.log('Elasticsearch Freightage idling', response);
        })

    }

    static saveFreightageDeleteToAnalytics = (ref_id) => {
        const freightagePickUpPrefix = 'delete'

        let body = {
            isDeleted: true,
            eventAt: (new Date()).getTime() + 20,
            ref_id,
        }

        const elasticsearchRequest = {
            method: elasticSearchMethod.put,
            uri: elasticSearchFreightUrl(freightagePickUpPrefix, ref_id),
            body,
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            console.log('Elasticsearch freightage deleted', response);
        })

    }

}
