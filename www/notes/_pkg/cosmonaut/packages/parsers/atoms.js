// @cosmonaut/parsers/atoms.js

// The only blocks that touch the stream's token-level API directly.
// Everything else in this package is built out of these plus each other.

import { decorate } from './_internal.js';

export const

check   = value => decorate (stream => stream.check(value) ? true : undefined),
expect  = value => decorate (stream => stream.consume(value)),
token   = value => decorate (stream => stream.match  (value)),

any     = ()    => decorate (stream => stream.eof() ? undefined : stream.next()),
eof     = ()    => decorate (stream => stream.eof() ? true : undefined),

succeed = value => decorate (stream => value),
fail    = ()    => decorate (stream => undefined);
