# muster
Muster of sockets ...

# statuses
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

```json
{
  "tx": "049b7020-c787-41bf-a1d2-a97612c11418",
  "time": 1518248771817,
  "action": "authenticate",
  "options":{
    "type":"basic"
  },
  "payload":{
    "user":"test",
    "password":"password",
    "publicKey":"[keypair used to decrypt re-establish]"
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
    "edge": "[this edge node address]"
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


