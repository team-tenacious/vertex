# vertex
Clustered pubsub using hash-ring to distribute load

# premise

## cluster first
This is a cluster-first pub-sub solution - so not meant for single instance use, the idea is that we build clustering in from the ground up instead of warping a single-process design to cluster.

## topology

### top level entities:
1. client - the client of the cluster, can login, publish and subscribe.
2. edge node - a cluster member that holds client connections, and forwards subscribe and publish requests into the cluster.
3. search node - a cluster member that looks up subscriptions and forwards to relevant edge nodes, the search node also branches the publish address into wildcard permutations and uses the hash-ring to forward to other search nodes.

NB: edge nodes can also be search nodes

## subscriptions are costly, publication work is distributed
all servers in the cluster have access to the full subscription list, each new subscription results in a cluster wide broadcast, the idea here is that subscriptions happen less often than publish operations. Publish operations on the other hand go through an edge node (one that holds client connections and sessions) - this node uses a hash-ring to direct the message to an internal cluster node (search  node) that finds all the edge nodes that house subscribers that want to see the message and forward the message to them, the edge nodes in turn look up the subscribers amongst those clients connected to them and publish the event to the clients.

## why the hash-ring?
What is nice about using the hash-ring instead of random or round robin (which could become a config setting later) - is that each search node will hold an LRU cache for commonly published to addresses, if a hash-ring is used to logically arrange search requests across the cluster, the LRU cache from a cluster perspective, will be less fragmented, if subscription addresses are very random, the hash-ring will distribute requests randomly - so a nice balance.

## about wildcards
On publish, the publish addresses are branched into the original address, ie: "/test/1/2" and into the additional wildcard options: "/test/1/*", "/test/*/*", "/*/*/*" - this is done by the search node (not the edge node) - which forwards these search requests to other search nodes identified by the hash ring. These can now be looked up by a key/value store of they are not available in the LRU cache of the search nodes, ie: redis?

NB: this does mean that / and * are special characters and that /1/* is not the same as /1/*/2

## about subscription lookups

Subscriptions are in a tree structure, with 3 levels:

1. address - the actual subscription path, ie: "/test/1/2"
2. edge - the address of the edge node the subscription lives on
3. session - the session id of the client listening for events with stringified subscription options, this is so we can have 2 identical subscriptions that may need to be handled differently because of their options.

The LRU cache and database are keyed by the address of the subscriptions, so the lookup is small for search nodes, edge nodes need only loop through subscriptions in the branch keyed by their own IP and port.

```javascript
{
  address:{
    "/test/1/2":{
      edge:{
        "10:0.0.1:6000":{ //edge node address and port
            session:{
            "eyJpc3MiOiJzY290Y2:{\"some\":\"option\"}":{ //session id
              refCount:3 //essentially 
            }
          }
        }
      }
    }
  }
}
```
## about refCounts and subscription ids

Clients perform subscribe requests only once for subscription path and option combinations, following that a local refCount is incremented or decremented depending on subscribe or unsubscribes - when the local refCount reaches zero a cluster unsubscribe message happens. Edge nodes do something similar whereby the subscription record is only broadcasted once consecutive subscribes and unsubscribes are also managed through a refCount which only broadcasts an unsubscribe/subscribe when it is 0 or 1 respectively.

# protocol:

## happy path, login, subscribe, publish
<img src="https://user-images.githubusercontent.com/1958406/36060561-d8e2c56e-0e54-11e8-918b-12875682ec16.png"></img>

## statuses
```javascript
const statuses = {
  action:{
      ok:1,
      failed:2
  }
}
```

# messages:

## authenticate:

```javascript
var authenticatePacket = {
  "tx": "049b7020-c787-41bf-a1d2-a97612c11418", //client generated tx id, so client is able to match up replies
  "time": 1518248771817, //client generated timestamp
  "action": "authenticate", //message type
  "options":{ //action options - to change possible behaviour
    "type":"basic"
  },
  "payload":{ //in a non-secured system this could be null
    "user":"test",
    "password":"password",
    "publicKey":"[keypair used to decrypt re-establish token]"
  }
}
```

## authenticate ack

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c11418",
  "time": 1518248991817,
  "action": "authenticate-ack",
  "payload":{
    "status": 1,
    "sessionId":"eyJpc3MiOiJzY290Y2",
    "token": "eyJpc3MiOiJzY290Y2guaW8iLCJleHAiOjEzMDA4MTkzODAsIm5hbWUiOiJDaHJpcyBTZXZpbGxlamEiLCJhZG1pbiI6dHJ1ZX0"
  }
}
```
## subscribe

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c11418",
  "time": 1518248991817,
  "action": "subscribe",
  "options":{
    "action":"*"
  },
  "payload":{
    "sessionId":"eyJpc3MiOiJzY290Y2",
    "address": "/test/*/*"
  }
}
```

## subscribe broadcast

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c11400",
  "time": 151824911817,
  "action": "broadcast",
  "options":{},
  "payload":{
    "edge": "[this edge node address]",
    "subscription":{
      "tx": "049b7020-c787-41bf-a1d2-a97612c11418",
      "time": 1518248991817,
      "action": "subscribe",
      "options":{
        "action":"*"
      },
      "payload":{
        "sessionId":"eyJpc3MiOiJzY290Y2",
        "address": "/test/*/*"
      }
    }
  }
}
```

## subscribe broadcast ack

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c11400",
  "time": 151824911817,
  "action": "broadcast-ack",
  "options": {},
  "payload":{
    "status": 1
  }
}
```

## subscribe ack

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c11418",
  "time": 1518248991817,
  "action": "subscribe-ack",
  "payload":{
    "status": 1
  }
}
```

## publish

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c112222",
  "time": 1518248991899,
  "action": "publish",
  "options":{
    "merge":true
  },
  "payload":{
    "address": "/test/1/2",
    "data":{
      "test":"data"
    }
  }
}
```

## publish forward
*goes to edge node looked up in the subscriptions table*
```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c112223",
  "time": 1518248991900,
  "action": "publish-forward",
  "options":{},
  "payload":{
    "publication":{
      "tx": "049b7020-c787-41bf-a1d2-a97612c112222",
      "time": 1518248991899,
      "action": "publish",
      "options":{
        "merge":true
      },
      "payload":{
        "address": "/test/1/2",
        "data":{
          "test":"data"
        }
      }
    }
  }
}
```

## publish forward ack

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c112223",
  "time": 1518248991900,
  "action": "publish-forward-ack",
  "options":{},
  "payload":{
    "status":1
  }
}
```

## publish ack

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c112222",
  "time": 1518248991999,
  "action": "publish-ack",
  "payload":{
    "status":1
  }
}
```

## notify forward
*sent to the edge node from the node that checks the subscriptions for edge nodes that house subscriber sessions relevant to the path, note - no sessionId here, the edge node looks for matching sessions and forwards the notifications, not the address and subscription fields, address is the published on path, subscription is how the edge node was found (so may be a wildcard path)*

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c112224",
  "time": 1518249991900,
  "action": "notify-forward",
  "options":{},
  "payload":{
    "tx": "049b7020-c787-41bf-a1d2-a97612c112222",
    "time": 1518248991899,
    "action": "publish",
    "options":{
      "merge":true
    },
    "payload":{
      "address": "/test/1/2",
      "subscription": "/test/*/*",
      "data":{
        "test":"data"
      }
    }
  }
}
```

## notify
*sent from the edge node to the client which has a session subscribed to the path, note address and subscription fields*

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c112224",
  "time": 1518249991900,
  "action": "notify",
  "payload":{
    "address": "/test/1/2",
    "subscription": "/test/*/*",
    "data":{
      "test":"data"
    }
  }
}
```

# how data could be shared

If we use redis as the central db for subscriptions, our edge nodes could become the database updaters - so they essentially push changes to the subscription tree as necessary, after the change is written to the db a broadcast happens cluster wide that causes search nodes to update their caches, this is a nice performant flow that prevents the database getting locked or having concurrency issues because everyone is updating the db on broadcast.

