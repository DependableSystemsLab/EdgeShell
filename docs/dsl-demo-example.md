### RIoTBench-PRED

![RIoTBench PRED](images/riot-pred.png)
* From [dream-lab/riot-bench](https://github.com/dream-lab/riot-bench#statistical-summarization-dataflow-stats)

**OneOS-DSL Expression**
```
cd /ubc/demo

spawn BlobRead.js as "Reader"						// Creates spawned node, adds to "Reader" node group
node DecisionTree.js as "DecisionTree"				// Creates staged node, adds to "DecisionTree" node group
3 * (node LinearReg.js #LargeCPU as "LinearReg")	// Creates 3 staged nodes that need to run on devices with the #LargeCPU attribute, adds them to "LinearReg" node group
node MQTTPub.js as "Publisher"

connect [
	node MQTTSub.js ~> Reader,
	Reader ~> DecisionTree,
	Reader -> LinearReg,							// "->" = pool processing

	node Source.js ~> node Parse.js as "Parse",
	Parse ~> [DecisionTree, node Average.js as "Avg"],
	Parse -> LinearReg,

	[LinearReg, Avg] ~> node ErrorEstimate.js #LargeMem ~> Publisher
	DecisionTree ~> Publisher
	Publisher ~> node Sink.js
] as "ML-PRED"

spawn "ML-PRED"										// Spawns all staged nodes in the graph

2 * (spawn LinearReg.js #LargeCPU as "LinearReg")	// Adds 2 more running node to the "LinearReg" node group
```



## Resulting Graph ("ML_PRED")
```
"ML-PRED":
MQTTSub.js ~> BlobRead.js
BlobRead.js ~> DecisionTree.js
BlobRead.js -> LinearReg.js #LargeCPU
BlobRead.js -> LinearReg.js #LargeCPU
BlobRead.js -> LinearReg.js #LargeCPU
Source.js ~> Parse.js
Parse.js ~> DecisionTree.js
Parse.js ~> Average.js
Parse.js -> LinearReg.js #LargeCPU
Parse.js -> LinearReg.js #LargeCPU
Parse.js -> LinearReg.js #LargeCPU
LinearReg.js #LargeCPU ~> ErrorEstimate.js #LargeMem
LinearReg.js #LargeCPU ~> ErrorEstimate.js #LargeMem
LinearReg.js #LargeCPU ~> ErrorEstimate.js #LargeMem
Average.js ~> ErrorEstimate.js #LargeMem
ErrorEstimate.js #LargeMem ~> MQTTPub.js
MQTTPub.js ~> Sink.js
DecisionTree.js ~> MQTTPub.js
```

## Resulting Node Groups
```
"Reader":
BlobRead.js

"DecisionTree":
DecisionTree.js

"LinearReg":
LinearReg.js #LargeCPU
LinearReg.js #LargeCPU
LinearReg.js #LargeCPU

"Publisher":
MQTTPub.js

"Parse":
Parse.js

"Avg":
Average.js

"ErrEst":
ErrorEstimate.js #LargeMem

"Sink":
Sink.js
```