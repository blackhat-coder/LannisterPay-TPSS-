
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

const ads = [{title:"Hello, world!"}]

app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('combined'));

app.listen(3001, () => {
    console.log("listening on port 3001");
});

app.post("/split-payments/compute", (req, res) => {
    console.log("function logged");
    let id = req.body.ID ;
    var balance = req.body.Amount;
    let split_info = req.body.SplitInfo;

    let response = {
        "ID":req.body.ID,
        "Balance":0,
        "SplitBreakdown":[]
    }
    
    let split_info_len = req.body.SplitInfo.length;
    
    if (split_info_len < 1 || split_info_len > 20 ){
        res.status(400).send("SplitInfo for ID:"+id+" is less < 1 or > 20");
    }

    let split_seq_flat = [];
    let split_seq_per = [];
    let split_seq_rat = [];

    for (let i=0; i<split_info_len; i++){
        if ( split_info[i]["SplitType"] == "FLAT"){
            split_seq_flat.push(i)
        } else if (split_info[i]["SplitType"] == "PERCENTAGE") {
            split_seq_per.push(i)
        } else{
            split_seq_rat.push(i)
        }
    }
    let split_seq = split_seq_flat.concat(split_seq_per, split_seq_rat) ;
    
    var total_ratio = 0;
    let ratio_index = [];

    for (let x in split_seq){
        let i = split_seq[x] ;

        let entity = split_info[i]

        if (entity.SplitType == "FLAT"){

            if ( entity.SplitValue > req.body.Amount){
                res.status(400).send("Split Amount cannot be greater than transaction amount: "+req.body.Amount+ " for id: " +entity.SplitEntityId);
            }

            if (entity.SplitValue < 0 ){
                res.status(400).send("Split Amount cannot be less than 0 for id: " +entity.SplitEntityId);
            }

            balance = balance - entity.SplitValue;

            response.SplitBreakdown.push({
                "SplitEntityId": entity.SplitEntityId,
                "Amount": entity.SplitValue
            })

        } else if (entity.SplitType == "PERCENTAGE"){
            let p = ((entity.SplitValue/100) * balance);
            if (p > req.body.Amount){
                res.status(400).send("Split Amount cannot be greater than transaction amount: "+req.body.Amount+ " for id: " +entity.SplitEntityId);
            }
            if (p < 0){
                res.status(400).send("Split Amount cannot be less than 0 for id: " +entity.SplitEntityId);
            }
            balance = balance - p;

            response.SplitBreakdown.push({
                "SplitEntityId": entity.SplitEntityId,
                "Amount": p
            })
        } else {
            total_ratio += entity.SplitValue;
            ratio_index.push(i);
        }
    }
    let opening_ratio_balance = balance ;
    for (let x in ratio_index){
        let i = ratio_index[x];

        let entity = split_info[i]

        if ( entity.SplitValue > req.body.Amount){
            // console.log("The split amount cannot be greater than transaction amount");
            res.status(400).send("Split Amount cannot be greater than transaction amount: "+req.body.Amount+ " for id: " +entity.SplitEntityId);
        }

        let p = ((entity.SplitValue/total_ratio) * opening_ratio_balance);
        if (p < 0){
            res.status(400).send("split amount is less than 0 for id: "+entity.SplitEntityId);
        }
        balance = balance - p;

        response.SplitBreakdown.push({
            "SplitEntityId": entity.SplitEntityId,
            "Amount": p
        })
    }

    if (balance < 0){
        res.status(400).send("Final Balance: "+balance+" < 0");
    } else {
        response["Balance"] = balance;
    }

    res.status(200).send(response);
});