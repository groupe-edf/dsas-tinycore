<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $dsas = simplexml_load_file(_DSAS_XML);
  $errors = array();

  try {
    switch ($_POST["op"]){
      case "all":
        $data = $_POST["data"];
        $ifaces = get_ifaces();
        $iface_ok = false;
        foreach ($ifaces as $iface) {
          if (trim($data["bas"]) == $iface["name"]) {
            $iface_ok = true;
            $dsas->config->network->bas = $iface["name"];
            break;
          }
        }
        if (! $iface_ok)
           $errors[] = [ "bas" => "Interface invalid"];

        $iface_ok = false;
        foreach ($ifaces as $iface) {
          if (trim($data["haut"]) == $iface["name"]) {
            $iface_ok = true;
            $dsas->config->network->haut = $iface["name"];
            break;
          }
        }
        if (! $iface_ok)
           $errors[] = [ "haut" => "Interface invalid"];       

        foreach ($data["interfaces"] as $net) {
          $iface_ok = false;
          $j = 0;
          foreach ($ifaces as $iface) {
            if (trim($net["device"]) == $iface["name"]) {
              $iface_ok = true;
              break;
            }
            $j++;
          }
          if (! $iface_ok) {
            $errors[] = [ "error" => "Interface " . $net["device"] . " n'existe pas." ];
            break;
          }

          if ($net["dhcp"] == "true")
            $dsas->config->network->interfaces->interface[$j]->dhcp = "true";
          else
            $dsas->config->network->interfaces->interface[$j]->dhcp = "false";

          $cidr = htmlspecialchars(trim($net["cidr"]));
          $cidr_err = inet_valid($cidr, false);
          if (empty($cidr_err))
            $dsas->config->network->interfaces->interface[$j]->cidr = $cidr;
          else
            $errors[] = [ "iface_cidr" . $j => $cidr_err];


          $gateway = htmlspecialchars(trim($net["gateway"]));
          $gateway_err = inet_valid($gateway, true);
          if (empty($gateway_err))
            $dsas->config->network->interfaces->interface[$j]->gateway = $gateway;
          else
            $errors[] = [ "iface_gateway" . $j => $gateway_err];

          if (is_valid_domain($net["dns"]["domain"]))
             $dsas->config->network->interfaces->interface[$j]->dns->domain = $net["dns"]["domain"];
          else
             $errors[] = [ "iface_dns_domain" . $j => $gateway_err];
          
          foreach ($net["dns"]["nameserver"] as $server) {
            if (!empty($dns_err = inet_valid($server, true)))
              break;
          }
          if (empty($dns_err)) {
            //error_log(print_r($net,true));
            unset($dsas->config->network->interfaces->interface[$j]->dns->nameserver);
            foreach ($net["dns"]["nameserver"] as $server)
              $dsas->config->network->interfaces->interface[$j]->dns->nameserver[] = $server;
        } else
          $errors[] = ["iface_nameserver" .$j => $dns_err];
        }

        break;

      default:
        $errors[] = ["error" => "Operation '" . $_POST["op"] . "' demand&eacute; inconnu"]; 
        break;
    }
  } catch (Exception $e) {
     $error[] = ["error" => "Internal server error : " + e];
  }
 
  if ($errors == []) {
    echo "Ok";
    $dsas->asXml(_DSAS_XML);    
  } else {
    header("Content-Type: application/json");
    echo json_encode($errors);
  }
} else {
  $dsas = simplexml_load_file(_DSAS_XML);
  $ifaces = get_ifaces();
  $network = new SimpleXMLElement('<?xml version="1.0" ?><network></network>');
  $network->bas = $dsas->config->network->bas;
  $network->haut = $dsas->config->network->haut;
  $interfaces = $network->addChild("interfaces");

  foreach ($ifaces as $iface) {
    $ifaceok = false;
    foreach ($dsas->config->network->interfaces->children() as $child) {
      if ($child->device == $iface["name"]) {
        // Have an interface and it's configured already
        $newiface = $interfaces->addChild("interface");
        append_simplexml($newiface, $child);
        $ifaceok = true;
        break;
      }
    }
    if (! $ifaceok) {
      // We have an unconfigured interface
      $child = new SimpleXMLElement('<?xml version="1.0" ?><tmp><interface><device>' . $iface['name'] . '</device><dhcp>true</dhcp><cidr /><gateway /><dns><domain /><nameserver /></dns></interface></tmp>');
      $newiface = $interfaces->addChild("interface");
      append_simplexml($newiface, $child);
    }        
  }
  header("Content-Type: application/json");
  echo json_encode($network);
}

?>