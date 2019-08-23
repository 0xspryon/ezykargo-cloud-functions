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
      "amount": {
        "type": "long"
      },
      "bizAmount": {
        "type": "long"
      },
      "weight": {
        "type": "long"
      },
      "volume": {
        "type": "long"
      },
      "to": {
        "type": "keyword"
      },
      "from": {
        "type": "keyword"
      },
      "title": {
        "type": "text"
      },
      "ref_id": {
        "type": "keyword"
      },
      "items": {
        "properties": {
          "from": {
            "type": "keyword"
          },
          "quantity": {
            "type": "long"
          },
          "weight": {
            "type": "long"
          },
          "unit_type": {
            "type": "keyword"
          }
        }
      },
      "eventAt": {
        "type": "date"
      },
      "pickup": {
        "type": "boolean"
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
      "amount": {
        "type": "long"
      },
      "bizAmount": {
        "type": "long"
      },
      "weight": {
        "type": "long"
      },
      "volume": {
        "type": "long"
      },
      "to": {
        "type": "keyword"
      },
      "from": {
        "type": "keyword"
      },
      "title": {
        "type": "text"
      },
      "items": {
        "properties": {
          "from": {
            "type": "keyword"
          },
          "quantity": {
            "type": "long"
          },
          "weight": {
            "type": "long"
          },
          "unit_type": {
            "type": "keyword"
          }
        }
      },
      "eventAt": {
        "type": "date"
      },
      "completed": {
          "type": "boolean"
        },
      "paid": {
          "type": "boolean"
        },
      "platform_amount": {
        "type": "long"
      },
      "ref_id": {
        "type": "keyword"
      }
    }
  }
}
