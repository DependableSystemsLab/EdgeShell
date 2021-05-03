const Spawner = require("./spawner.js");
const path = require("path");

const graphTypes = require("./structures.js");
const Node = graphTypes.Node;
const Edge = graphTypes.Edge;
const Graph = graphTypes.Graph;
const NodeGroup = graphTypes.NodeGroup;

function is_node_group(env, name) {
    return env.NodeGroups[name] != undefined;
}

function is_graph(env, name) {
    return env.Graphs[name] != undefined;
}

function is_piping_op(exp) {
    var piping_ops = " -> -*> ~> ~/> ~*> ";
    return exp.type == "op" && piping_ops.includes(" " + exp.operator + " ");
}

function get_edge(sender, receiver, pipe) {
    for (var edge of sender.out_edges) {
        if (edge.receiver == receiver && edge.pipe == pipe) {
            return edge;
        }
    }
    return null;
}

function spawn_node_group(env, group) {
    // Spawn each node that has not been spawned
    for (var nd of group.nodes) {
        if (nd.pid == null) {
            env.nodeSpawnQueue.add(nd);
        }
    }
}


function spawn_graph(env, graph) {
    /* Spawns staged nodes in the graph. Pipes are automatically created by the Spawner between
     * edges consisting of at least one staged node when the node is spawned. */
    for (var edge of graph.edges) {
        var senders = edge.sender instanceof NodeGroup ? edge.sender.nodes : [edge.sender]
        var receivers = edge.receiver instanceof NodeGroup ? edge.receiver.nodes : [edge.receiver]
        for (var sender of senders) {
            for (var receiver of receivers) {
                // Explictly create edges if both nodes are spawned.
                if (sender.pid != null && receiver.pid != null) {
                    env.edgeSpawnQueue.add(new Edge(sender, receiver));
                } else {
                    if (sender.pid == null) {
                        env.nodeSpawnQueue.add(sender);
                    }
                    if (receiver.pid == null) {
                        env.nodeSpawnQueue.add(receiver);
                    }
                }
            }
        }
    }
}

function add_node_to_group(env, name, nd) {
    if (env.NodeGroups[name] == undefined) {
        env.NodeGroups[name] = new NodeGroup(name);
    }
    nd.group = env.NodeGroups[name];
    env.NodeGroups[name].nodes.push(nd);
}

function get_node_group(env, name) {
    var group = env.NodeGroups[name];
    if (group == undefined) {
        throw new Error(`No node group named \"${name}\"`);
    }
    return group;
}

function verify_node_arg(env, cmd, first_arg) {
    var arg_val = first_arg.value;
    if (first_arg.type == "num") {
        throw new Error(
            `Invalid first argument \"${arg_val}\": \"${cmd}\" command needs a *.js or *.py file as the first argument`
        );
    }

    var file_types = " .js  .py ";
    if (file_types.indexOf(arg_val.substr(arg_val.length - 3)) < 0) {
        throw new Error(
            `Invalid file \"${arg_val}\": \"${cmd}\" command needs a *.js or *.py file as the first argument`
        );
    } else {
        // Check the file exists
        env.verifs.push(env.api.fileExists(path.resolve(env.cwd, arg_val)));
    }
}

function get_args(args_arr) {
    // TODO: parse command options (e.g. --help or -h)?
    return args_arr.map((arg) => arg.value);
}

function create_node(env, exp, spawn) {
    var first_arg = exp.args[0];
    verify_node_arg(env, cmd, first_arg);

    var file_name = first_arg.value;
    var args = get_args(exp.args.slice(1));
    var nd = new Node(file_name, args, exp.attrs);

    if (exp.group) {
        add_node_to_group(env, exp.group, nd);
    } else if (spawn == false && !env.curr_graph) {
        throw new Error(
            "A staged node must be assigned to a node group or be defined within a graph"
        );
    }

    if (spawn == true) {
        env.nodeSpawnQueue.add(nd);
    }

    return nd;
}

function get_nodes_and_groups(env, nested_arr) {
    var node_arr = [];
    for (var i = 0; i < nested_arr.length; i++) {
        if (Array.isArray(nested_arr[i])) {
            node_arr = node_arr.concat(
                get_nodes_and_groups(env, nested_arr[i])
            );
        } else {
            var node = nested_arr[i];
            if (typeof node == "string") {
                // Get the corresponding node group
                node_arr.push(get_node_group(env, node));
            } else {
                node_arr.push(node);
            }
        }
    }
    return node_arr;
}

function create_edges(env, senders, receivers, op) {
    for (var sender of senders) {
        for (var receiver of receivers) {
            var edge = get_edge(sender, receiver, op);
            if (edge == null) {
                edge = new Edge(sender, receiver, op);
                sender.out_edges.push(edge);
                receiver.in_edges.push(edge);
            }
            edge.graphs.push(env.curr_graph.name);
            env.curr_graph.edges.push(edge);
        }
    }
}

async function create_implicit_graph(op_exp, env) {
    var edges = [];
    var graph = new Graph(env.num_implicit_graphs);
    env.curr_graph = graph;
    edges.push(await apply_op(env, op_exp.operator, op_exp.left, op_exp.right));
    env.curr_graph = null;

    env.Graphs[env.num_implicit_graphs] = graph;
    spawn_graph(env, graph);

    return graph;
}

async function evaluate(exp, env) {
    switch (exp.type) {
        case "num":
        case "str":
        case "id":
            return exp.value;

        case "cmd":
            return await evaluate_cmd(exp, env);

        case "op":
            // A graph is implicitly created when a piping is used outside of the connect command edge list
            // e.g. 10 * (spawn map.js) -> 4 * (spawn reduce.js #camera) ~> spawn reduce.js log.txt
            if (is_piping_op(exp) && !env.curr_graph) {
                return await create_implicit_graph(exp, env);
            } else {
                return await apply_op(env, exp.operator, exp.left, exp.right);
            }

        case "list":
            var val = [];
            for (var exp of exp.elems) {
                val.push(await evaluate(exp, env));
            }
            return val;

        case "prog":
            var res = [];
            for (var exp of exp.prog) {
                res.push(await evaluate(exp, env));
                // console.log(res); // TODO: remove print after debugging
            }

            // Wait until async verifications resolve
            await Promise.all(env.verifs)
                .then(() => {
                    let spawner = new Spawner(env);
                    return Promise.all([
                        spawner.spawn_nodes(env.nodeSpawnQueue),
                        spawner.create_pipes(env.edgeSpawnQueue),
                    ]);
                })
                .finally(() => {
                    return env.doneEval();
                });

            return res;

        default:
            throw new Error("I don't know how to evaluate " + exp.type);
    }
}

async function evaluate_cmd(exp, env) {
    var cmd = exp.cmd;
    switch (cmd) {
        case "node":
            return create_node(env, exp, false);

        case "spawn":
            // If first arg is a string, then we are spawning an existing node group or graph
            var first_arg = exp.args[0];
            if (first_arg.type == "str") {
                // TODO: prevent a graph and node group from having the same name
                var id = first_arg.value;
                if (is_node_group(env, id)) {
                    spawn_node_group(env, env.NodeGroups[id]);
                } else if (is_graph(env, id)) {
                    spawn_graph(env, env.Graphs[id]);
                } else {
                    throw new Error(
                        `\"${id}\" does not correspond to a node group or graph`
                    );
                }
                return;
            } else {
                // We are spawning a new node
                return create_node(env, exp, true);
            }

        case "connect":
            /* Create a graph */
            var graph_name = exp.graph;
            if (is_graph(env, graph_name)) {
                throw new Error(`Graph \"${graph_name}\" already exists`);
            }

            var graph = new Graph(exp.graph);

            env.curr_graph = graph;
            await evaluate(exp.args[0], env);
            env.curr_graph = null;

            env.Graphs[graph_name] = graph;
            return graph;

        case "spawn_connect":
            // Can create an unamed graph (no, automatically assign a name) Graph1
            console.log("spawn_connect cmd not yet supported");
            return;

        default:
            return await env
                .get(exp.cmd)
                .then((res) => res(get_args(exp.args), env));
    }
}

async function apply_op(env, op, left_exp, right_exp) {
    function num(x) {
        if (typeof x != "number")
            throw new Error("Expected number but got " + x);
        return x;
    }
    switch (op) {
        case "*":
            var x = await evaluate(left_exp, env);
            var vals = [];
            for (var i = 0; i < num(x); i++) {
                vals.push(await evaluate(right_exp, env));
            }
            return vals;
        case "~>":
        case "->":
        case "-*>":
        case "~*>":
        case "~/>":
            var senders = await evaluate(left_exp, env);
            var receivers = await evaluate(right_exp, env);

            /* Note: Depending on the evaluation result, senders and receivers can contain nested arrays
            of Nodes and IDs of NodeGroups or they may be a single Node or NodeGroup ID. We want to flatten
            them into a 1D array of Nodes and NodeGroups */
            if (!Array.isArray(senders)) senders = [senders];
            if (!Array.isArray(receivers)) receivers = [receivers];
            senders = get_nodes_and_groups(env, senders);
            receivers = get_nodes_and_groups(env, receivers);

            create_edges(env, senders, receivers, op);
            return receivers; // Return receivers so we can chain pipes
    }
    throw new Error("Can't apply operator " + op);
}

module.exports = evaluate;
