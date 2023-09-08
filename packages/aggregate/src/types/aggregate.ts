
export type ID = string

export interface IEvent { } // eslint-disable-line

interface INodeMetadata {
  id: string
  index: number
}

export interface IEventNode <EventBase extends IEvent = IEvent>{
  event: EventBase
  metadata: INodeMetadata
}

export interface IModel {
  id: string,
  [key: string]: any,
}

export type IAggregateFailureHandler = (error: Error) => void

export interface IAggregateRoot<M extends IModel, E extends IEvent = IEvent> {
  id: string
  apply: (event: E, isFromHistory?: boolean) => void
  commit: () => void
  getUncommittedEvents: () => E[]
  getLoadedEvents: () => E[]
  getLoadedEventNodes: () => IEventNode<E>[]
  getState: () => M
  loadFromHistory: (history: E[]) => void
  loadFromEventNodes: (history: IEventNode<E>[]) => void
  uncommit: () => void
  snapshot: () => E | void
  setFailureHandler: (handler: IAggregateFailureHandler) => void
}
