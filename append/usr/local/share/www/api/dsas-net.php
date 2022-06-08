<?php
require_once "common.php";

if (! dsas_loggedin())
  header("HTTP/1.0 403 Forbidden");
else if($_SERVER["REQUEST_METHOD"] == "POST"){
  $errors = array();

  try {
   $dsas = simplexml_load_file(_DSAS_XML);
   if (! $dsas)
     throw new RuntimeException("Error loading XML file");
     
    switch ($_POST["op"]){
      case "all":
        /** @var array{bas: array{dhcp: string, cidr: string, gateway: string, 
          *                       dns: array{domain: string, nameserver: string[]}},
          *            haut: array{dhcp: string, cidr: string, gateway: string, 
          *                       dns: array{domain: string, nameserver: string[]}}} $data */
        $data = json_decode($_POST["data"], true);
        $ifaces = get_ifaces();
        $j=0;
        foreach (["bas", "haut"] as $iface) {
          $net = $data[$iface];

          if ($net["dhcp"] == "true") {
            $dsas->config->network->{$iface}->dhcp = "true";
            continue;
          } else
            $dsas->config->network->{$iface}->dhcp = "false";

          $cidr = htmlspecialchars(trim($net["cidr"]));
          $cidr_err = ip_valid($cidr, false);
          if (empty($cidr_err))
            $dsas->config->network->{$iface}->cidr = $cidr;
          else
            $errors[] = [ "iface_cidr" . $j => $cidr_err];

          $gateway = htmlspecialchars(trim($net["gateway"]));
          if (empty($gateway))
            $gateway_err = "";
          else
            $gateway_err = ip_valid($gateway, true);
          if (empty($gateway_err))
            $dsas->config->network->{$iface}->gateway = $gateway;
          else
            $errors[] = [ "iface_gateway" . $j => $gateway_err];

          if (empty($net["dns"]["domain"]) || is_valid_domain($net["dns"]["domain"]))
             $dsas->config->network->{$iface}->dns->domain = $net["dns"]["domain"];
          else
             $errors[] = [ "iface_dns_domain" . $j => "Domain is invalid"];
          
          foreach ($net["dns"]["nameserver"] as $server) {
            if (!empty($dns_err = ip_valid($server, true)))
              break;
          }
          if (empty($dns_err)) {
            unset($dsas->config->network->{$iface}->dns->nameserver);
            foreach ($net["dns"]["nameserver"] as $server)
              $dsas->config->network->{$iface}->dns->nameserver[] = $server;
          } else
            $errors[] = ["iface_nameserver" .$j => $dns_err];

          $j++;
        }
        break;

      default:
        $errors[] = ["error" => ["Unknown operation '{0}' requested", (string)$_POST["op"]]]; 
        break;
    }
  } catch (Exception $e) {
     $errors[] = ["error" => ["Internal server error : {0}", $e->getMessage()]];
  }
 
  if ($dsas !== false && $errors == []) {
    echo "Ok";
    $dsas->asXml(_DSAS_XML);    
  } else {
    header("Content-Type: application/json");
    echo json_encode($errors);
  }
} else {
  $dsas = simplexml_load_file(_DSAS_XML);
  if (! $dsas)
    header("HTTP/1.0 500 Internal Server Error");
  else {
    header("Content-Type: application/json");
    echo json_encode($dsas->config->network);
  }
}

?>
