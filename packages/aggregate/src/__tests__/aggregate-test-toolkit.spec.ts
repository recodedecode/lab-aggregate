import { AggregateRoot } from '../aggregate'
import { IEvent } from '../types'
import { check } from '../utils'


type Whenable = (aggregate: AggregateRoot) => void

describe('Aggregate test toolkit', () => {

  describe('should pass', () => {

    it('should validate included event', async () => {

      class Created implements IEvent {}

      const applyEvent: Whenable = aggregate =>
        aggregate.apply(new Created())

      check(new AggregateRoot())
        .when(applyEvent)
        .has.event(Created)
    })

    it('should validate async method', async () => {

      class Created implements IEvent {}

      const applyEvent: Whenable = async (aggregate) =>
        Promise.resolve(aggregate.apply(new Created()))

      await check(new AggregateRoot())
        .after(applyEvent)
        .then(aggregate => {
          aggregate.has.event(Created)
        })
    })

    it('should validate event is excluded', async () => {

      class Created {}
      class Updated {}

      const applyEvent: Whenable = aggregate =>
        aggregate.apply(new Updated())


      check(new AggregateRoot())
        .when(applyEvent)
        .excludes.event(Created)
    })

    it('should validate only one event is included', async () => {

      class Created {}
      class Updated {}

      const applyCreatedEvent: Whenable = aggregate =>
        aggregate.apply(new Created())

      const applyUpdatedEvent: Whenable = aggregate =>
        aggregate.apply(new Updated())

      check(new AggregateRoot())
        .when(applyCreatedEvent)
        .when(applyUpdatedEvent)
        .has.one.event(Created)
    })

    it('should validate has exactly x events', async () => {

      class Created {}
      class Updated {}

      const applyCreatedEvent: Whenable = aggregate =>
        aggregate.apply(new Created())

      const applyUpdatedEvent: Whenable = aggregate =>
        aggregate.apply(new Updated())

      check(new AggregateRoot())
        .when(applyCreatedEvent)
        .when(applyUpdatedEvent)
        .when(applyUpdatedEvent)
        .has.exactly(2).events(Updated)
    })

    it('should validate first event', async () => {

      class First {}
      class Middle {}
      class Last {}

      const applyFirstEvent: Whenable = aggregate =>
        aggregate.apply(new First())

      const applyMiddleEvent: Whenable = aggregate =>
        aggregate.apply(new Middle())

      const applyLastEvent: Whenable = aggregate =>
        aggregate.apply(new Last())

      check(new AggregateRoot())
        .when(applyFirstEvent)
        .when(applyMiddleEvent)
        .when(applyLastEvent)
        .has.first.event(First)
    })

    it('should validate last event', async () => {

      class First {}
      class Middle {}
      class Last {}

      const applyFirstEvent: Whenable = aggregate =>
        aggregate.apply(new First())

      const applyMiddleEvent: Whenable = aggregate =>
        aggregate.apply(new Middle())

      const applyLastEvent: Whenable = aggregate =>
        aggregate.apply(new Last())

      check(new AggregateRoot())
        .when(applyFirstEvent)
        .when(applyMiddleEvent)
        .when(applyLastEvent)
        .has.last.event(Last)
    })

    it('should validate first and last event', async () => {

      class First {}
      class Middle {}
      class Last {}

      const applyFirstEvent: Whenable = aggregate =>
        aggregate.apply(new First())

      const applyMiddleEvent: Whenable = aggregate =>
        aggregate.apply(new Middle())

      const applyLastEvent: Whenable = aggregate =>
        aggregate.apply(new Last())

      check(new AggregateRoot())
        .when(applyFirstEvent)
        .when(applyMiddleEvent)
        .when(applyLastEvent)
        .has.first.event(First)
        .and.has.last.event(Last)
    })

    it('should validate event includes', async () => {

      class First {
        constructor (
          public readonly id: string,
          public readonly name: string,
          public readonly likes: string[],
        ) {}
      }

      class Second {
        constructor (
          public readonly id: string,
          public readonly name: string
        ) {}
      }

      const applyFirstEvent: Whenable = aggregate =>
        aggregate.apply(new First('3', 'Marz', ['film', 'tech']))

      const applySecondEvent: Whenable = aggregate =>
        aggregate.apply(new Second('2', 'Earth'))

      check(new AggregateRoot())
        .when(applyFirstEvent)
        .when(applySecondEvent)
        .has.event(First).that.includes({
          id: '3',
          name: 'Marz',
          likes: ['film', 'tech'],
        })
    })

  })

})
