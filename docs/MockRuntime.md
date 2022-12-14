### `MockRuntime.js` API


#### **(constructor)** `MockRuntime()`

Creates a new `MockRuntime` instance.

*Example*
```
let runtime = new MockRuntime()
```

---

#### (async method) `runtime.spawn(absolutePath, args)`

Runs an executable at the given `absolutePath` string, passing an array `args` of command line arguments. Returns a number indicating the PID of the newly created process. Throws error if there is no file at the given `absolutePath`.

*Example*
```
let pid = await runtime.spawn('/home/ubc/bin/sensor.js')
```

---

#### (async method) `runtime.kill(pid)`

Kills the process with the given `pid` (number). Throws error if there is no process with the given `pid`.

*Example*
```
await runtime.kill(1234)
```

---

#### (async method) `runtime.createPipe(sourceId, sinkId)`

Creates a pipe from the process with PID = `sourceId` to the process with PID = `sinkId`. Returns a string indicating the ID of the newly created pipe. Throws error if the pipe already exists, or if either the source or the sink process does not exist.

*Example*
```
let pipeId = await runtime.createPipe(1234, 5678)
```

---

#### (async method) `runtime.deletePipe(pipeId)`

Removes the pipe with the given `pipeId` (string). Throws error if there is no pipe with the given `pipeId`.

*Example*
```
await runtime.deletePipe('1234-5678')
```

---

#### (async method) `runtime.listProcesses()`

Returns a list of processes. This method is analogous to the unix `ps` command.

*Example*
```
await runtime.listProcesses()
```

---

#### (async method) `runtime.listFiles(absPath)`

Returns a list of files if the object at the absolute path `absPath` is a directory. This method is analogous to the unix `ls` command.

*Example*
```
await runtime.listFiles('/home/ubc/bin')
```

---

#### (async method) `runtime.listHosts()`

Returns a list of host machines.

*Example*
```
await runtime.listHosts()
```

---

#### (async method) `runtime.findHostsByTag(tag, ...moreTags)`

Returns a list of host machines containing the given `tag`. The given `tag` can be a `string`, or and `Array` of `string` tags. In the case it is an `Array`, it searches for hosts containing all of the given tags. The method accepts variadic arguments and returns a disjunction of filtered results.

For instance, if `runtime.findHostsByTag(['A', 'B', 'C'], 'D', 'E')` is called, the result will include hosts that has all `'A'`, `'B'`, and `'C'` tags, hosts that has a `'D'` tag, and hosts that has an `'E'` tag.

*Example*
```
await runtime.findHostsByTag(['sensor', 'quad-core'], 'actuator')
// returns hosts containing both 'sensor' and 'quad-core' tags, and hosts with 'actuator' tag
```

---