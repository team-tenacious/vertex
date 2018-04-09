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
On publish, the publish addresses are branched into the original address, ie: "/test/1/2" and into the additional wildcard options: "/test/1/*", "/test/*/*", "/*/*/*" - this is done by the search node (not the edge node) - which forwards these search requests to other search nodes identified by the hash ring. These can now be looked up by the redis key/value store of they are not available in the LRU cache of the search nodes.

NB: this does mean that / and * are special characters and that /1/* is not the same as /1/*/2

## about refCounts and subscription ids

Clients perform subscribe requests only once for subscription path and option combinations, following that a local refCount is incremented or decremented depending on subscribe or unsubscribes - when the local refCount reaches zero a cluster unsubscribe message happens. Edge nodes do something similar whereby the subscription record is only broadcasted once consecutive subscribes and unsubscribes are also managed through a refCount which only broadcasts an unsubscribe/subscribe when it is 0 or 1 respectively.



