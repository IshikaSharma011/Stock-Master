<?php
session_start();
header('Content-Type: application/json');

// Simple file helpers
function read_json($file){
  if(!file_exists($file)) return [];
  $s = file_get_contents($file);
  $j = json_decode($s,true);
  return $j ? $j : [];
}
function write_json($file,$data){
  file_put_contents($file,json_encode($data,JSON_PRETTY_PRINT),LOCK_EX);
}

// Files
$USERS='users.json';
$PRODUCTS='products.json';
$OPS='ops.json'; // receipts, deliveries, transfers, adjustments, ledger

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? '';

function respond($ok,$msg,$extra=[]){
  echo json_encode(array_merge(['success'=>$ok,'message'=>$msg],$extra));
  exit;
}

// AUTH: signup
if($action=='signup'){
  $name=$input['name']??'';
  $email=strtolower(trim($input['email']??''));
  $pass=$input['pass']??'';
  if(!$email || !$pass) respond(false,'Provide email & password');
  $users = read_json($USERS);
  foreach($users as $u) if($u['email']==$email) respond(false,'Email exists');
  $users[] = [
    'id'=>time().rand(10,99),
    'name'=>$name,
    'email'=>$email,
    'pass'=>password_hash($pass,PASSWORD_DEFAULT),
    'created'=>time()
  ];
  write_json($USERS,$users);
  respond(true,'Account created');
}

// AUTH: login
if($action=='login'){
  $email=strtolower(trim($input['email']??''));
  $pass=$input['pass']??'';
  $users = read_json($USERS);
  foreach($users as $u){
    if($u['email']==$email && password_verify($pass,$u['pass'])){
      $_SESSION['user']=$u;
      respond(true,'Logged in',['user'=>['name'=>$u['name'],'email'=>$u['email']]]);
    }
  }
  respond(false,'Invalid credentials');
}

// SEND OTP (demo)
if($action=='send_otp'){
  $email=strtolower(trim($input['email']??''));
  if(!$email) respond(false,'Provide email');
  $users = read_json($USERS);
  $found=false;
  foreach($users as &$u){
    if($u['email']==$email){
      $otp = rand(100000,999999);
      $u['otp']=$otp;
      $u['otp_exp']=time()+300; // 5 min
      $found=true;
      // In production: send via SMS/email. For demo we return OTP.
      write_json($USERS,$users);
      respond(true,'OTP sent (demo)', ['otp'=>$otp]);
    }
  }
  respond(false,'User not found');
}

// RESET password with OTP
if($action=='reset_password'){
  $email=strtolower(trim($input['email']??''));
  $code=$input['code']??'';
  $newpass=$input['newpass']??'';
  if(!$email || !$code || !$newpass) respond(false,'Missing fields');
  $users = read_json($USERS);
  foreach($users as &$u){
    if($u['email']==$email){
      if(isset($u['otp']) && $u['otp']==$code && $u['otp_exp']>time()){
        $u['pass']=password_hash($newpass,PASSWORD_DEFAULT);
        unset($u['otp']); unset($u['otp_exp']);
        write_json($USERS,$users);
        respond(true,'Password reset');
      } else respond(false,'Invalid or expired OTP');
    }
  }
  respond(false,'User not found');
}

// LOGOUT
if($action=='logout'){
  session_destroy();
  respond(true,'Logged out');
}

// require logged in for below
if(!isset($_SESSION['user'])) respond(false,'Not authenticated');

// helper: get user id/name
$currentUser = $_SESSION['user']['email'] ?? 'unknown';

// PRODUCTS
if($action=='create_product'){
  $name=$input['name']??''; $sku=$input['sku']??''; $cat=$input['category']??''; $uom=$input['uom']??'pcs';
  $initial = intval($input['initial']??0); $location = $input['location']??'Default';
  if(!$name || !$sku) respond(false,'Name & SKU required');
  $products = read_json($PRODUCTS);
  // if sku exists, update
  $found=false;
  foreach($products as &$p){
    if($p['sku']==$sku){
      $p['name']=$name; $p['category']=$cat; $p['uom']=$uom;
      // optionally set initial in specified location
      if($initial>0) $p['locations'][$location] = ($p['locations'][$location]??0) + $initial;
      $found=true;
      write_json($PRODUCTS,$products);
      respond(true,'Product updated');
    }
  }
  if(!$found){
    $products[] = [
      'sku'=>$sku,
      'name'=>$name,
      'category'=>$cat,
      'uom'=>$uom,
      'locations'=> [ $location => $initial ],
      'created'=>time()
    ];
    write_json($PRODUCTS,$products);
    // optionally add an ops ledger entry for initial receipt
    $ops = read_json($OPS);
    if($initial>0){
      $ops[] = ['type'=>'receipt','details'=>"Initial stock {$initial} @ {$location} for {$sku}",'by'=>$currentUser,'time'=>time()];
      write_json($OPS,$ops);
    }
    respond(true,'Product created');
  }
}

// LIST PRODUCTS
if($action=='list_products'){
  $q = strtolower(trim($input['q']??''));
  $products = read_json($PRODUCTS);
  if($q){
    $products = array_filter($products, function($p) use ($q){
      return strpos(strtolower($p['name']),$q)!==false || strpos(strtolower($p['sku']),$q)!==false;
    });
  }
  respond(true,'ok',['data'=>array_values($products)]);
}

// CREATE RECEIPT
if($action=='create_receipt'){
  $supplier = $input['supplier']??'';
  $location = $input['location']??'Default';
  $lines = $input['lines']??[];
  if(!count($lines)) respond(false,'No lines');
  $products = read_json($PRODUCTS);
  foreach($lines as $ln){
    $sku = $ln['sku']; $qty = intval($ln['qty']);
    // find product
    $found=false;
    foreach($products as &$p){
      if($p['sku']==$sku){
        $p['locations'][$location] = ($p['locations'][$location]??0) + $qty;
        $found=true;
        break;
      }
    }
    if(!$found){
      // create simple product record if missing
      $products[] = ['sku'=>$sku,'name'=>$sku,'category'=>'Uncategorized','uom'=>'pcs','locations'=>[$location=>$qty],'created'=>time()];
    }
  }
  write_json($PRODUCTS,$products);
  $ops = read_json($OPS);
  $ops[]=['type'=>'receipt','details'=>"Receipt from {$supplier} to {$location} lines: ".count($lines),'by'=>$currentUser,'time'=>time(),'meta'=>$lines];
  write_json($OPS,$ops);
  respond(true,'Receipt created');
}

// CREATE DELIVERY
if($action=='create_delivery'){
  $customer = $input['customer']??'';
  $location = $input['location']??'Default';
  $lines = $input['lines']??[];
  if(!count($lines)) respond(false,'No lines');
  $products = read_json($PRODUCTS);
  foreach($lines as $ln){
    $sku = $ln['sku']; $qty = intval($ln['qty']);
    $found=false;
    foreach($products as &$p){
      if($p['sku']==$sku){
        $p['locations'][$location] = max(0, ($p['locations'][$location]??0) - $qty);
        $found=true;
        break;
      }
    }
    if(!$found){
      // nothing to deduct but create product placeholder with negative stock at location
      $products[] = ['sku'=>$sku,'name'=>$sku,'category'=>'Uncategorized','uom'=>'pcs','locations'=>[$location=>-1*$qty],'created'=>time()];
    }
  }
  write_json($PRODUCTS,$products);
  $ops = read_json($OPS);
  $ops[]=['type'=>'delivery','details'=>"Delivery to {$customer} from {$location} lines: ".count($lines),'by'=>$currentUser,'time'=>time(),'meta'=>$lines];
  write_json($OPS,$ops);
  respond(true,'Delivery created');
}

// TRANSFER
if($action=='create_transfer'){
  $sku=$input['sku']??''; $from=$input['from']??''; $to=$input['to']??''; $qty=intval($input['qty']??0);
  if(!$sku || !$from || !$to || $qty<=0) respond(false,'Missing fields');
  $products = read_json($PRODUCTS);
  $found=false;
  foreach($products as &$p){
    if($p['sku']==$sku){
      $p['locations'][$from] = max(0, ($p['locations'][$from]??0)-$qty);
      $p['locations'][$to] = ($p['locations'][$to]??0) + $qty;
      $found=true; break;
    }
  }
  if(!$found){
    // create placeholder with negative src and positive dest
    $products[]=['sku'=>$sku,'name'=>$sku,'category'=>'Uncategorized','uom'=>'pcs','locations'=>[$from=>-1*$qty,$to=>$qty],'created'=>time()];
  }
  write_json($PRODUCTS,$products);
  $ops = read_json($OPS);
  $ops[]=['type'=>'transfer','details'=>"Transfer {$qty} of {$sku} from {$from} to {$to}",'by'=>$currentUser,'time'=>time()];
  write_json($OPS,$ops);
  respond(true,'Transfer logged');
}

// ADJUSTMENT (count-based)
if($action=='create_adjustment'){
  $sku=$input['sku']??''; $loc=$input['loc']?? $input['location'] ?? 'Default'; $count = intval($input['count']??$input['counted']??0); $reason=$input['reason']??'adjustment';
  if(!$sku) respond(false,'SKU needed');
  $products = read_json($PRODUCTS);
  $found=false;
  foreach($products as &$p){
    if($p['sku']==$sku){
      $old = $p['locations'][$loc]??0;
      $p['locations'][$loc] = $count;
      $found=true;
      break;
    }
  }
  if(!$found){
    $products[]=['sku'=>$sku,'name'=>$sku,'category'=>'Uncategorized','uom'=>'pcs','locations'=>[$loc=>$count],'created'=>time()];
  }
  write_json($PRODUCTS,$products);
  $ops = read_json($OPS);
  $ops[]=['type'=>'adjustment','details'=>"Adjustment for {$sku} at {$loc} to {$count} (reason: {$reason})",'by'=>$currentUser,'time'=>time()];
  write_json($OPS,$ops);
  respond(true,'Stock adjusted');
}

// GET HISTORY
if($action=='get_history'){
  $ops = read_json($OPS);
  respond(true,'ok',['data'=>$ops]);
}

// DASHBOARD KPIs
if($action=='get_dashboard'){
  $products = read_json($PRODUCTS);
  $ops = read_json($OPS);
  $total_products = count($products);
  $low_stock = 0;
  foreach($products as $p){
    $sum = array_sum(array_values($p['locations'] ?? []));
    if($sum<=0) $low_stock++;
    else if($sum<=5) $low_stock++;
  }
  // pending receipts/deliveries = count of ops of type receipt/delivery in last 24h with no extra status (simple)
  $pending_receipts = 0; $pending_deliveries = 0;
  $cut = time() - 24*3600;
  foreach($ops as $o){
    if($o['time']>$cut){
      if($o['type']=='receipt') $pending_receipts++;
      if($o['type']=='delivery') $pending_deliveries++;
    }
  }
  respond(true,'ok',[
    'total_products'=>$total_products,
    'low_stock'=>$low_stock,
    'pending_receipts'=>$pending_receipts,
    'pending_deliveries'=>$pending_deliveries
  ]);
}

// Default: unknown action
respond(false,'Unknown action');
