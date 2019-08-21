//kibana commands.


//mappings for frieghtage*

//frieghtage_created
PUT freightage_created
{
  "mappings": {
    "properties": {
      "eventAt": {
        "type": "date"
      },
      "created": {
          "type": "boolean"
        },
      "ref_id": {
        "type": "keyword"
      }
    }
  }
}

//freightage picked up
PUT freightage_picked_up
{
  "mappings": {
    "properties": {
      "eventAt": {
        "type": "date"
      },
      "pickup": {
        "type": "boolean"
      },
      "ref_id": {
        "type": "keyword"
      }
    }
  }
}

PUT freightage_delivered
{
  "mappings": {
    "properties": {
      "eventAt": {
        "type": "date"
      },
      "delivered": {
          "type": "boolean"
        },
      "ref_id": {
        "type": "keyword"
      }
    }
  }
}

PUT freightage_completed
{
  "mappings": {
    "properties": {
      "eventAt": {
        "type": "date"
      },
      "completed": {
          "type": "boolean"
        },
      "ref_id": {
        "type": "keyword"
      }
    }
  }
}
