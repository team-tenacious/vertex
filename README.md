# muster
Message cluster

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
    "tx": "049b7020-c787-41bf-a1d2-a97612c11418",
    "time": 1518248991817,
    "action": "subscribe",
    "options":{
      "action":"*"
    },
    "payload":{
      "address": "/test/*/*"
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
