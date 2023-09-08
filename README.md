# Event Source Aggregate

A Nestjs based library for building and testing Event Sourced Aggregates.

The aggregate design here, while inspired by the excellent work in  [Nestjs CQRS](https://github.com/nestjs/cqrs), contains several important distinctions that enable for a more constrained workflow designed to be used within an event sourced framework. While the `AggregateRoot` contains many similarities it distinguishes itself by excluding the auto-commit and publishing functions while adding methods for event snapshotting and custom failure handling.

Perhaps what differentiates this the most is the addition of a test toolkit designed to specifically help with testing aggregate domain events.

## Contents

* [Aggregate Root](#aggregate-root)
* [Test Toolkit](#test-toolkit)

## Aggregate Root

The `AggregateRoot` is straight forward and can be used to apply domain events based on business rules. All applied events that have a corresponding event handler method will have that automatically invoked where state can then be modified internally if required.

The `AggregateRoot` implements an interface that allows for a specific method of event snapshotting. If the service used to commit the event stream has snapshotting enabled, then the snapshot method will be called and this event will be persisted. When the aggregate event stream is loaded the snapshot event will be injected and it's handler called. You can see this from the below code example where the snapshot event takes current state and when loaded back sets this on the aggregate.

Snapshotting this way has some intentional design trade-offs and may not be what you want. In general when snapshotting you do not load the aggregates full event stream history and if your business rules require you to inspect or verify historical events then there is no guarantee they will be loaded. You must also be careful in how you rebuild state and version snapshotting should your internal state require breaking changes. 



### Basic Aggregate Example

Below is a basic example demonstrating how you might compose your aggregate from the `AggregateRoot`.

```typescript
import { AggregateRoot } from '@recodedecode/aggregate'
import { NameNotAllowedDomainError } from './errors'
import { AddedBearNameEvent, SnapshotBearV1Event } from './events'


interface IBear {
  name: string
}

class Bear extends AggregateRoot<IBear> {
  
  protected state: IBear = {
    name: ''
  }
  
  public addName (name: string) {
    
    if (name === 'yogi') {
			throw NameNotAllowedDomainError('There can be only one Yogi Bear')
    }

		this.apply(new AddedBearNameEvent(name))
  }
  
  protected onAddedBearNameEvent (event: AddedBearNameEvent) {
		this.state = {
      ...this.state,
      name: event.name,
    }
  }

  public snapshot () {
		return new SnapshotBearV1Event(
    	this.state
    )
  }
  
  protected onSnapshotBearV1Event (event: SnapshotBearV1Event) {
    this.state = event.data
  }
  
}
```



### Snapshots & their tradeoffs

There are a few ways to perform snapshots in EventSourcing. The approach taken here makes several assumptions about how you use aggregates. It assumes that you use events that when applied build up differential state on an internal `state` object. This object can then be passed into a Snapshot event class as data. When the Aggreate is then loaded from the snapshot, it uses the snapshot data as the initial internal `state` object. All subsequent events are applied over the top.

This means that if you expect to load the full aggregate event history in order to perform business logic it will fail. That is those events likely have not been loaded and will not be available for evaluation. If you need the full history available in your aggregate then you will not want to perform snapshotting.

### Locking the Aggretate and Handling Failures

If you are not working with a modern event database then you may need to setup a way to lock and unlock your aggregate when applying changes in order to preserve event ordering.

You may choose to do this in your aggregate loader service and in these cases it can be helpful to have a way to unlock the aggregate should it error.

This can be achieved with the `setFailureHandler` which accepts a custom function that can be invoked when a domain error occures within the aggregate.

The below demonstrates how it may be used by first locking the aggregate based on it's ID. Then it sets the failure handler so that when the aggregate throws an error it will automatically be unlocked.

#### Aggregate Loader Service

```typescript
export class AggregateManagerService<T extends AggregateRoot> {
  
  constructor (
    private readonly eventService: EventStreamService,
    private readonly lockService: LockService,
  ) { }
  
  public async create (aggregateId?: ID): Promise<T> {
    const aggregate = new this.aggregate(aggregateId)
    return aggregate
  }
  
  public async load (aggregateId: ID): Promise<T> {

    if (await this.isLocked(aggregateId)) {
      throw new UnprocessableError()
    }
    
    await this.lockAggregate(aggregateId)
    const eventHistory = await eventService.loadEventStream(aggregateId)
    return this.loadAggregate(aggregateId, eventHistory)
  }
  
  public async commit (aggregate: T): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents()
    await eventService.save(aggregate.id, uncommittedEvents)
    await this.unlockAggregate(aggregate.id)
  }
  
  protected loadAggregate (aggregateId: ID, eventHistory: IEventNode<IEvent>[]): T {
    const aggregate = new this.aggregate(aggregateId)

    aggregate.setFailureHandler((error) => {
      this.unlockAggregate(aggregate.id)
      throw error
    })

    aggregate.loadFromEventNodes(eventHistory)
    return aggregate as T
  }
  
  private async isLocked (aggregateId: ID): boolean {
    // logic to check if aggregate is locked
    const lock = await lockService.isLocked(aggregateId)
    return locked
  }
  
  private async lockAggregate (aggregateId: ID) {
    // logic to lock aggregate
    const lock = await lockService.lock(aggregateId)
  }
  
  private async unlockAggregate (aggregateId: ID) {
    // logic to unlock aggregate
    const lock = await lockService.unlock(aggregateId)
  }
  
}
```

#### Aggregate Use

The below example loads an aggregate ensuring it is locked and loaded. We then perform our business operations on the aggregate. If this operation fails it will unlock the aggregate before throwing the error due to us previously setting the failure handler. Finally it commits the events which will be published to the event stream.

```typescript
const aggregate = await aggregateManagerService.load(aggregateId)

aggregate.signUp(registrationInfo)

aggregateManagerService.commit(aggregate)
```




## Test Toolkit

The test toolkit enables you to chain assertions together like other popular bdd testing libraries. It passes the aggregate through to `when` methods where you can perform operations on it and then check the appopriate events have been applied.

The intention is to validate events rather than internal state as internal state is prone to change while events are not. There are escape hatches should you need for the rare case where you need to verify internal state is what you expect but this should almost never be required.

This approach to testing has the added benefit of self-documenting how the aggregate should be used and the common flows associated with it.

#### Test Toolkit Example

The below example registers a new user and publishes both the `RegisteredUserEvent` and tests for a `RequestedUserEmailVerificationEvent` also. We also ensure that an error is thrown when we try and verify the email with an incorrect token. As well as ensuring the error is thrown we validate that the `VerifiedUserEmailEvent` was not included. Finally, we then test the email verification with a valid token.

```javascript
import { check } from '@recodedecode/nest-aggregate'
import { UserAggregate } from './user-aggregate'


describe('User Aggregate', () => {

  let aggregateId
  let email
  let username
  let verificationToken

  beforeEach(() => {
    aggregateId = '01'
    email = 'yogi@jellystone.com'
    username = 'yogi'
    verificationToken = '123'
  })

  it('should register a new bear', () => {

    check(new UserAggregate(aggregateId))
   
      // register user
      .when(aggregate => aggregate.register(email, verificationToken))
      .has.one.event(RegisteredUserEvent)
      .that.includes({ email })
      .and.has.one.event(RequestedUserEmailVerificationEvent)
  
      // Add username
    	.and.when(aggregate => aggregate.addUsername("yogi bear"))
    	.and.when(aggregate => aggregate.addUsername(username))
    	.has.exactly(2).events(AddedUserUsernameEvent)
    	.and.has.last.event(AddedUserUsernameEvent)
    	.that.includes({ username })
  
    	// Invalid email verification
    	.and.throws.when(aggregate => aggregate.verifyEmail("invalid token"))
    	.and.excludes.event(VerifiedUserEmailEvent)
  
      // Valid email verificaiton
      .and.when(aggregate => aggregate.verifyEmail(verificationToken))
      .has.one.event(VerifiedUserEmailEvent)
    	.that.includes({ email })
  })
})
```
