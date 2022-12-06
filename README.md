## EdgeShell

This repository contains a working draft of EdgeShell, the domain-specific language for [OneOS](https://github.com/DependableSystemsLab/OneOS).

* [Poster (presented at SEC 2022)](./docs/SEC2022-EdgeShell.pdf)


### Motivation

Developers today need to make various choices when writing a distributed edge application, such as what communication protocol to use for transmitting data or what storage solution to use for storing data. There is a plethora of frameworks and tools available, but no de facto standard. As a result, the written application becomes a one-and-only solution that becomes obsolete when one of the tools it relies on revises its API or drops support.

### Approach

We propose to decouple the application logic (i.e., the computation) from the logistics (i.e., the I/O) when programming edge applications. An application should be composed of purely logical components pieced together from the outside. Each component should be more or less a black box, only defining what it accepts as input and what it produces as output. The how and where to the data is sent should be defined outside at the platform layer. This paradigm, which follows the UNIX philosophy, makes it easy to reuse a component in different applications and easy to replace a component in an application.

In addition to expressing the data flow of the application, the developer should be able to express requirements in terms of deployment, performance, reliability, and security. Once the requirements are defined, the application platform should be responsible for satisfying the requirements (or rejecting the requirement based on satisfiability). Considering the above, we propose a domain-specific language for describing distributed edge applications called *EdgeShell*. Below is an example of what it looks like.

```
graph HomeSecurity (device = '/dev/video0') {
  node streamer: process('ffmpeg', device)
  node analyzer: process('node', 'analyzer.js')
  node reporter: process('node', 'reporter.js')
  node recorder: process('python', 'recorder.py')
  edge upload: streamer -> analyzer
  analyzer -> reporter
  analyzer -> recorder
}
```

The `graph` keyword is used to define a graph, which is the representation of an edge application. Inside the `graph` definition, the developer uses the `node` keyword to declare a component, using the `process` function to indicate that it is a process. A component can also be a more lightweight `function`, that simply transforms a message. The `edge` keyword is used to label the connection between two `node`s -- i.e., transport the output from a component to the input of another component. It can be omitted if the `edge` is not be referenced by other objects.

