function parse(input) {
  var PRECEDENCE = {
    "~>": 1,
    "->": 1,
    "-*>": 1,
    "~*>": 1,
    "~/>": 1,
    "*": 2,
  };
  var functionArgs = [];

  function is_punc(ch) {
    var tok = input.peek();
    return tok && tok.type == "punc" && (!ch || tok.value == ch) && tok;
  }

  function is_kw(kw) {
    var tok = input.peek();
    return tok && tok.type == "kw" && (!kw || tok.value == kw) && tok;
  }

  function is_op(op) {
    var tok = input.peek();
    return tok && tok.type == "op" && (!op || tok.value == op) && tok;
  }

  function is_pipe_op() {
    var tok = input.peek();
    var pipes = " -> -*> ~> ~/> ~*> ";
    return tok && tok.type == "op" && pipes.includes(" " + tok.value + " ");
  }

  function next_is_pipe_op() {
    var tok = input.peek2();
    var pipes = " -> -*> ~> ~/> ~*> ";
    return tok && tok.type == "op" && pipes.includes(" " + tok.value + " ");
  }

  function is_new_line() {
    var tok = input.peek();
    return tok && tok.type == "new_line" && tok;
  }

  function is_word() {
    var tok = input.peek();
    return tok && tok.type == "w" && tok;
  }

  function is_str() {
    var tok = input.peek();
    return tok && tok.type == "str" && tok;
  }

  function is_num() {
    var tok = input.peek();
    return tok && tok.type == "num" && tok;
  }

  function is_valid_arg() {
    return is_word() || is_str() || is_num();
  }

  function is_cmd(cmd) {
    var tok = input.peek();
    return tok && tok.type == "cmd" && (!cmd || cmd == tok.value) && tok;
  }

  function is_attr() {
    var tok = input.peek();
    return tok && tok.type == "attr" && tok;
  }

  function is_list() {
    return is_punc("[");
  }

  function skip_punc(ch) {
    if (is_punc(ch)) input.next();
    else input.croak('Expecting punctuation: "' + ch + '"');
  }

  function skip_kw(kw) {
    if (is_kw(kw)) input.next();
    else input.croak('Expecting keyword: "' + kw + '"');
  }

  function skip_op(op) {
    if (is_op(op)) input.next();
    else input.croak('Expecting operator: "' + op + '"');
  }

  function skip_cmd(op) {
    if (is_cmd(op)) input.next();
    else input.croak('Expecting command: "' + op + '"');
  }

  function skip_while(is_type) {
    while (is_type()) {
      input.next();
    }
  }

  function unexpected() {
    input.croak("Unexpected token: " + JSON.stringify(input.peek()));
  }

  function maybe_op(left, my_prec) {
    var tok = is_op();

    if (tok) {
      var his_prec = PRECEDENCE[tok.value];
      if (his_prec > my_prec) {
        var is_pipe = is_pipe_op();
        input.next();

        /* Allow piping operations to span multiple lines */
        if (is_pipe) {
          skip_while(is_new_line);
        }

        return maybe_op(
          {
            type: "op",
            operator: tok.value,
            left: left,
            right: maybe_op(parse_atom(is_pipe), his_prec),
          },
          my_prec
        );
      }
    }
    return left;
  }

  function delimited(start, stop, separator, parser) {
    var a = [];
    var first = true;
    skip_punc(start);
    while (!input.eof()) {
      skip_while(is_new_line);
      if (is_punc(stop)) break;
      if (first) first = false;
      else {
        skip_punc(separator);
        skip_while(is_new_line);
      }
      if (is_punc(stop)) break;
      a.push(parser());
    }
    skip_punc(stop);
    return a;
  }

  function parse_connect_cmd() {
    skip_cmd("connect");

    // Connect expects a single list as the argument
    if (is_list()) {
      parsedList = parse_list(true);
    } else {
      input.croak("Expecting list as argument to connect command.");
    }

    // Parse "as" <name>
    var name = parse_name();

    if (!name) {
      input.croak('A graph created using "connect" must have a name');
    }

    return {
      type: "cmd",
      cmd: "connect",
      args: [parsedList],
      graph: name,
    };
  }

  function parse_spawn_connect_cmd() {
    skip_cmd("spawn_connect");

    // Connect expects a single list as the argument
    if (is_list()) {
      parsedList = parse_list(true);
    } else {
      input.croak("Expecting list as argument to spawn_connect command.");
    }

    return {
      type: "cmd",
      cmd: "spawn_connect",
      args: [parsedList],
    };
  }

  function parse_spawn_or_node_cmd() {
    cmd = input.next().value;

    var args = parse_args();
    if (args.length == 0) {
      input.croak(
        `\"${cmd}\" command expects a *.js or *.py file as an argument`
      );
    }

    // Parse attributes
    var attrs = [];
    while (is_attr()) {
      var attr = input.next();
      attrs.push(attr.value);
    }

    // Parse "as" <name>
    var name = parse_name();

    return {
      type: "cmd",
      cmd: cmd,
      args: args,
      group: name,
      attrs: attrs,
    };
  }

  function parse_cmd() {
    cmd = input.next().value;
    //console.log("Parsing command: " + cmd);
    // TODO: suport unix style options?
    var args = parse_args();

    return {
      type: "cmd",
      cmd: cmd,
      args: args,
    };
  }

  function parse_args() {
    // TODO: parse command options (e.g. --help or -h)?
    var args = [];
    while (is_valid_arg()) {
      args.push(input.next());
    }
    return args;
  }

  function parse_name() {
    var name = null;
    if (is_kw("as")) {
      input.next();
      if (is_str()) {
        name = input.next().value;
      } else {
        input.croak('Expecting string after "as" keyword.');
      }
    }
    return name;
  }

  function parse_node_cmd() {
    cmd = input.next().value;

    var args = [];
    while (input.next() != null) {
      var next = input.next().value;
      console.log("Arg: " + next);
      args.push(next);
    }
    return {
      type: "cmd",
      cmd: cmd,
      args: args,
    };
  }

  function parse_list(expect_id) {
    var parsed_elems = delimited("[", "]", ",", () =>
      parse_expression(expect_id)
    );
    return {
      type: "list",
      elems: parsed_elems,
    };
  }

  function parse_atom(expect_id, new_exp) {
    if (is_punc("(")) {
      input.next();
      var exp = parse_expression(expect_id);
      return exp;
    }

    if (is_list()) {
      return parse_list(expect_id);
    }

    if (is_cmd("connect")) {
      return parse_connect_cmd();
    }

    if (is_cmd("spawn_connect")) {
      return parse_spawn_connect_cmd();
    }

    if (is_cmd("spawn")) {
      return parse_spawn_or_node_cmd();
    }

    if (is_cmd("node")) {
      return parse_spawn_or_node_cmd();
    }

    if (is_cmd("edge")) {
      return parse_edge_cmd();
    }

    if (is_cmd()) {
      return parse_cmd();
    }

    var tok = input.peek();
    //console.log(tok);

    if (expect_id && tok.type == "w") {
      tok = input.next();
      return {
        type: "id",
        value: tok.value,
      };
    }

    if (tok.type == "num" || tok.type == "str") {
      tok = input.next();
      return tok;
    }

    // If this is the first word of a new expression, assume we encountered an unknown command
    if (new_exp && tok.type == "w") {
      return parse_cmd();
    }
    if (tok.type == "w" || tok.type == "punc") {
      tok = input.next();
      functionArgs.push(tok);
      return tok;
    }
    unexpected();
  }

  function parse_toplevel() {
    var prog = [];
    var new_exp = true;
    while (!input.eof()) {
      if (is_new_line()) {
        input.next();
        new_exp = true;
        continue;
      }
      prog.push(parse_expression(false, new_exp));
      new_exp = false;
    }
    return { type: "prog", prog: prog };
  }

  function parse_expression(expect_id, new_exp) {
    // Unknown words are assumed to be identifiers (i.e. names) of node groups
    // when they are on either side of a piping operator
    if (next_is_pipe_op()) {
      expect_id = true;
    }
    return maybe_op(parse_atom(expect_id, new_exp), 0);
  }

  return parse_toplevel();
}

module.exports = parse;
