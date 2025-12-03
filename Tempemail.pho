<?php
header("Content-Type: application/json");

// Base URL for temp mail service
$base = "https://www.1secmail.com/api/v1/";

// ============ GENERATE TEMP MAIL ============
if (isset($_GET['action']) && $_GET['action'] == "new") {

    $domains = ["1secmail.com", "1secmail.org", "1secmail.net"];
    $name = substr(str_shuffle("abcdefghijklmnopqrstuvwxyz1234567890"), 0, 10);
    $domain = $domains[array_rand($domains)];
    $email = $name . "@" . $domain;

    echo json_encode([
        "status" => "success",
        "email" => $email
    ]);
    exit;
}


// ============ CHECK EMAIL INBOX =============
if (isset($_GET['action']) && $_GET['action'] == "inbox") {

    if (!isset($_GET['email'])) {
        echo json_encode(["error" => "email parameter required"]);
        exit;
    }

    $email = $_GET['email'];
    list($login, $domain) = explode("@", $email);

    $url = $base . "?action=getMessages&login=$login&domain=$domain";
    $inbox = json_decode(file_get_contents($url), true);

    echo json_encode([
        "status" => "success",
        "email" => $email,
        "messages" => $inbox
    ]);
    exit;
}



// ============ READ SPECIFIC EMAIL ============
if (isset($_GET['action']) && $_GET['action'] == "read") {

    if (!isset($_GET['email']) || !isset($_GET['id'])) {
        echo json_encode(["error" => "email & id required"]);
        exit;
    }

    $email = $_GET['email'];
    $id = $_GET['id'];

    list($login, $domain) = explode("@", $email);

    $url = $base . "?action=readMessage&login=$login&domain=$domain&id=$id";

    $read = json_decode(file_get_contents($url), true);

    echo json_encode([
        "status" => "success",
        "email" => $email,
        "message" => $read
    ]);
    exit;
}



// If no action provided
echo json_encode([
    "error" => "Invalid action",
    "available_actions" => ["new", "inbox?email=", "read?email=&id="]
]);
      
