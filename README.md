## MTGBAN Stripe /Auth / User Portal... Thing.

### Part 1: Stripe
Stripe payment processing is (if you believe their admittedly extensive documentation) -
simple to test and a breeze to implement.

#### ***Cue Morgan Freeman's Voice...***

While stripe graciously provides upwards of 300 different events to sift through, there are a few flaws that exist within their delivery system that should make one question their role as an data **provider**. 
- They come ***unisigned*** by default
- There is **no** guarantee of delivery
- Events can both be sent and recieved out of order.
- May god have mercy on your little developer soul if you dare touch one of those events with a parser upon recieving it - you know, the thing thats built into like 96% of request libraries.

You can end up in a state where you've got a customer that has subscribed, successfully even - without having yet been assigned a customer id. 

***can you see my face right now?***

Anywho - the service itself is sound and trusted enough so thats what we're using. But not as a provider, instead we are using their webhook signals as... Signals.
