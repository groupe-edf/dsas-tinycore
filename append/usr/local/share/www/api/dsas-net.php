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

        foreach (["bas", "haut"] as $iface) {
          $net = $data[$iface];

          if ($net["dhcp"] == "true")
            $dsas->config->network->{$iface}->dhcp = "true";
          else
            $dsas->config->network->{$iface}->dhcp = "false";

          $cidr = htmlspecialchars(trim($net["cidr"]));
          $cidr_err = ip_valid($cidr, false);
          if (empty($cidr_err))
            $dsas->config->network->{$iface}->cidr = $cidr;
          else
            $errors[] = [ "iface_cidr" . $j => $cidr_err];


          $gateway = htmlspecialchars(trim($net["gateway"]));
          $gateway_err = ip_valid($gateway, true);
          if (empty($gateway_err))
            $dsas->config->network->{$iface}->gateway = $gateway;
          else
            $errors[] = [ "iface_gateway" . $j => $gateway_err];

          if (is_valid_domain($net["dns"]["domain"]))
             $dsas->config->network->{$iface}->dns->domain = $net["dns"]["domain"];
          else
             $errors[] = [ "iface_dns_domain" . $j => $gateway_err];
          
          foreach ($net["dns"]["nameserver"] as $server) {
            if (!empty($dns_err = ip_valid($server, true)))
              break;
          }
          if (empty($dns_err)) {
            //error_log(print_r($net,true));
            unset($dsas->config->network->{$iface}->dns->nameserver);
            foreach ($net["dns"]["nameserver"] as $server)
              $dsas->config->network->{$iface}->dns->nameserver[] = $server;
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
  header("Content-Type: application/json");
  echo json_encode($dsas->config->network);
}

?>