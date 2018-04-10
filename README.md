# vertex
Clustered pubsub using hash-ring to distribute load

# premise

## cluster first
This is a cluster-first pub-sub solution - so not meant for single instance use, the idea is that we build clustering in from the ground up instead of warping a single-process design to cluster.

## install
```
# make sure redis is installed and running
npm i vertex --save
# you are good to go
```

## code example

```javascript
const { Server, Client } = require(vertex);

var config = {
   name: 'myTestServerName',//you get a silly name if you leave this out
   logger: {
     level: 'info'//info,trace,error
   },
   services: {
     tcp: {
       host: '127.0.0.1',//bind to local loopback
       port: 60606//default is 60606, this is the internal tcp port that cluster comms for this node happens on
     },
     cluster: {
       secret: 'myTestClusterSecret',//everyone must know the same secret to join
       seed: true,//this is the first server we are starting
       join: ['127.0.0.1:60606','127.0.0.1:60607','127.0.0.1:60608']//list of nodes to rediscover if one is dropped and restarts
     },
     http: {
       port: 3737 //3737 by default - could be port 80, this is what the clients connect to
     }
   }
}

Server.create(config)

    .then(server => {

      var myServerInstance = server;
      //able to accept client connections to now

      var client = new Client({url: 'ws://localhost:3737'});

      client.on('connection-confirmed', function () {

        client.subscribe('/test/topic/*',
          function(message){//this is the subscription handler

            //message should be
            //{
            //  "topic": "/test/topic/1",
            //  "data": "test"
            //}

            client.disconnect({code: 1000, reason: 'intentional disconnect test'});
          })
          .then(function(ref){
            //you can unsubscribe using the ref
            //client.unsubscribe(ref).then(...)

            client.publish('/test/topic/1', {"test":"data"})
            .then(function(results){
              //you have published, data should appear in handler
            })
          })

      });

      client.connect();
    })

    .catch(err => {

    });

```

## cli

```bash

# make sure redis is installed and running

# start 2 servers which form a cluster

git clone

cd vertex

npm i

#STEP 1: start our seed server

> node bin/vertex-server -e true

#NB: client and server cli will show a vertex> prompt

#NB: once in the vertex prompt, client and server help can be show by typing h and enter

#NB: once in the vertex prompt, client and server are stopped and exited by typing x and enter

#STEP 2: open ANOTHER command prompt in same vertex folder location

#start another server, clustered with the seed server

> node bin/vertex-server -c 60607 -p 3738 -m '127.0.0.1:60606'

#NB: for options run node bin/vertex-server -h

#STEP 3: open YET ANOTHER command prompt in same vertex folder location

> node bin/vertex-client

#NB: a client has been started and has joined the cluster via the first default server

#STEP 4: open YET STILL ANOTHER command prompt (you now have 4 windows open) in same vertex folder location

> node bin/vertex-client -e 127.0.0.1:3738

#NB: a client has been started and joined to the cluster via the second started server

#NB: again, for options run node bin/vertex-client -h

#STEP 5: now subscribe the current client to a topic

vertex>sub /test/*

#NB: output looks a bit like this:
# subscribed to: /test/* ref: OrFHlcY1Rgaaf5qTbwhKQw/0

#STEP 6: switch to the previous client command prompt window (started by running "node bin/vertex-client")

#now publish some data to the topic you subscribed on the other client to

vertex>pub /test/1 test

#STEP 7: switch to other client session and check you received the message:
received publication: {
  "topic": "/test/1",
  "data": "test"
}

```

## performance
on an i7 processor mac, with 8 GB RAM running node 9 on a single process (so no benefit of clustering) the tests process a million messages in 20 seconds, so about 50k messages per sec

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
On publish, the publish addresses are branched into the original address, ie: "/test/1/2" and into the additional wildcard options: "/test/1/*", "/test/*/*", "/*/*/*" - this is done by the search node (not the edge node) - which forwards these search requests to other search nodes identified by the hash ring. These can now be looked up by the redis key/value store of they are not available in the LRU cache of the search nodes.

NB: this does mean that / and * are special characters and that /1/* is not the same as /1/*/2

## about refCounts and subscription ids

Clients perform subscribe requests only once for subscription path and option combinations, following that a local refCount is incremented or decremented depending on subscribe or unsubscribes - when the local refCount reaches zero a cluster unsubscribe message happens. Edge nodes do something similar whereby the subscription record is only broadcasted once consecutive subscribes and unsubscribes are also managed through a refCount which only broadcasts an unsubscribe/subscribe when it is 0 or 1 respectively.



