import { ID, IAggregateRoot, IAggregateFailureHandler, IEvent, IEventNode, IModel } from '../types'
import { nextFlakeId } from '../utils'


const INTERNAL_EVENTS = Symbol()
const INTERNAL_EVENTS_HISTORY = Symbol()
const INTERNAL_EVENTS_NODES_HISTORY = Symbol()
const FAILURE_HANDLER = Symbol()

export type IAggrgateClass<T extends AggregateRoot> = new (aggregateId?: ID) => T 

type EventHandler = (...args: any) => void | undefined

export class AggregateRoot<Model extends IModel = IModel, EventBase extends IEvent = IEvent> implements IAggregateRoot<Model, EventBase> {

  private readonly [INTERNAL_EVENTS]: EventBase[] = []
  private readonly [INTERNAL_EVENTS_HISTORY]: EventBase[] = []
  private readonly [INTERNAL_EVENTS_NODES_HISTORY]: IEventNode<EventBase>[] = []
  private [FAILURE_HANDLER]: IAggregateFailureHandler | null = null
  protected state: Model = {} as Model

  constructor (
    public readonly id: string = nextFlakeId()
  ) { }

  public getState (): Model {
    return this.state
  }

  public commit () {
    this[INTERNAL_EVENTS].length = 0
  }

  public uncommit () {
    this[INTERNAL_EVENTS].length = 0
  }
  
  public getUncommittedEvents () {
    return this[INTERNAL_EVENTS]
  }

  public getLoadedEvents () {
    return this[INTERNAL_EVENTS_HISTORY]
  }

  public getLoadedEventNodes () {
    return this[INTERNAL_EVENTS_NODES_HISTORY]
  }

  public loadFromHistory (history: EventBase[]) {
    history.forEach((event) => {
      this.apply(event, true)
      this[INTERNAL_EVENTS_HISTORY].push(event)
    })
  }

  public loadFromEventNodes (nodes: IEventNode<EventBase>[]) {
    nodes.forEach((node) => {
      this.apply(node.event, true)
      this[INTERNAL_EVENTS_NODES_HISTORY].push(node)
    })
    const events = nodes.map(node => node.event)
    this.loadFromHistory(events)
  }

  public snapshot (): EventBase | void {
    return
  }

  public apply (event: EventBase, isFromHistory = false) {
    if ( ! isFromHistory) {
      this[INTERNAL_EVENTS].push(event)
    }

    const handler = this.getEventHandler(event)
    handler && handler.call(this, event)
  }

  protected getEventHandler (event: EventBase): EventHandler | void {
    const handler = `on${this.getEventName(event)}`
    const method = (this as any)[handler]
  
    if (typeof method === 'function') {
      return method.bind(this)
    }
  }

  protected getEventName (event: any): string {
    const { constructor } = Object.getPrototypeOf(event)
    return constructor.name as string
  }

  protected getEventClassName (event: any): string {
    return event.name as string
  }

  public setFailureHandler (handler: IAggregateFailureHandler) {
    this[FAILURE_HANDLER] = handler
  }

  public fail (error: Error) {
    if (this[FAILURE_HANDLER]) {
      this[FAILURE_HANDLER](error)
      return
    }
    throw error
  }

}
