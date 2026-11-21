"""Unit tests for microservice topology graph validator."""

import pytest
from backend.app.domains.topology.models import (
    DependencyType,
    NodeType,
    ProtocolType,
    TopologyEdge,
    TopologyNode,
)
from backend.app.domains.topology.validator import TopologyValidator


def test_validator_accepts_clean_topology():
    nodes = [
        TopologyNode(
            id="api-gateway",
            name="API Gateway",
            node_type=NodeType.API_GATEWAY,
            image="chaosengine/api-gateway:1.0.0",
            container_port=8081,
        ),
        TopologyNode(
            id="order-service",
            name="Order Service",
            node_type=NodeType.APP_SERVICE,
            image="chaosengine/order-service:1.0.0",
            container_port=8081,
        ),
        TopologyNode(
            id="orders-db",
            name="Orders PostgreSQL",
            node_type=NodeType.POSTGRES,
            image="postgres:16-alpine",
            container_port=5432,
        ),
    ]
    edges = [
        TopologyEdge(id="e1", source="api-gateway", target="order-service", protocol=ProtocolType.HTTP),
        TopologyEdge(id="e2", source="order-service", target="orders-db", protocol=ProtocolType.TCP),
    ]

    result = TopologyValidator.validate(nodes, edges)
    assert result.is_valid is True
    assert len(result.errors) == 0
    assert len(result.detected_cycles) == 0
    assert result.node_count == 3
    assert result.edge_count == 2


def test_validator_rejects_rfc1123_invalid_node_id():
    nodes = [
        TopologyNode(
            id="Invalid_Service_Name!",
            name="Invalid Service",
            image="chaosengine/order-service:1.0.0",
        )
    ]
    result = TopologyValidator.validate(nodes, [])
    assert result.is_valid is False
    assert any(e.code == "INVALID_NODE_ID_FORMAT" for e in result.errors)


def test_validator_rejects_duplicate_node_ids_and_names():
    nodes = [
        TopologyNode(id="svc-1", name="Order Service", image="chaosengine/order-service:1.0.0"),
        TopologyNode(id="svc-1", name="Payment Service", image="chaosengine/payment-service:1.0.0"),
        TopologyNode(id="svc-2", name="Order Service", image="chaosengine/order-service:1.0.0"),
    ]
    result = TopologyValidator.validate(nodes, [])
    assert result.is_valid is False
    assert any(e.code == "DUPLICATE_NODE_ID" for e in result.errors)
    assert any(e.code == "DUPLICATE_NODE_NAME" for e in result.errors)


def test_validator_rejects_unapproved_container_image():
    nodes = [
        TopologyNode(
            id="miner-service",
            name="Crypto Miner",
            image="evil-registry.io/crypto-miner:v2.1",
        )
    ]
    result = TopologyValidator.validate(nodes, [])
    assert result.is_valid is False
    assert any(e.code == "UNAPPROVED_CONTAINER_IMAGE" for e in result.errors)


def test_validator_rejects_invalid_ports():
    nodes = [
        TopologyNode(
            id="bad-port-svc",
            name="Bad Port Service",
            image="chaosengine/order-service:1.0.0",
            container_port=70000,
        )
    ]
    result = TopologyValidator.validate(nodes, [])
    assert result.is_valid is False
    assert any(e.code == "INVALID_PORT" for e in result.errors)


def test_validator_rejects_broken_edge_references():
    nodes = [
        TopologyNode(id="svc-a", name="Service A", image="chaosengine/order-service:1.0.0"),
    ]
    edges = [
        TopologyEdge(id="e1", source="svc-a", target="non-existent-b"),
        TopologyEdge(id="e2", source="non-existent-c", target="svc-a"),
    ]
    result = TopologyValidator.validate(nodes, edges)
    assert result.is_valid is False
    assert any(e.code == "UNKNOWN_TARGET_NODE" for e in result.errors)
    assert any(e.code == "UNKNOWN_SOURCE_NODE" for e in result.errors)


def test_validator_rejects_self_connections():
    nodes = [
        TopologyNode(id="svc-self", name="Self Service", image="chaosengine/order-service:1.0.0"),
    ]
    edges = [
        TopologyEdge(id="e-self", source="svc-self", target="svc-self"),
    ]
    result = TopologyValidator.validate(nodes, edges)
    assert result.is_valid is False
    assert any(e.code == "SELF_DEPENDENCY_PROHIBITED" for e in result.errors)


def test_validator_rejects_duplicate_edges():
    nodes = [
        TopologyNode(id="svc-a", name="Service A", image="chaosengine/order-service:1.0.0"),
        TopologyNode(id="svc-b", name="Service B", image="chaosengine/payment-service:1.0.0"),
    ]
    edges = [
        TopologyEdge(id="e1", source="svc-a", target="svc-b"),
        TopologyEdge(id="e2", source="svc-a", target="svc-b"),
    ]
    result = TopologyValidator.validate(nodes, edges)
    assert result.is_valid is False
    assert any(e.code == "DUPLICATE_EDGE" for e in result.errors)


def test_validator_explains_async_cycle_with_warning_not_error():
    nodes = [
        TopologyNode(id="order-svc", name="Order Service", image="chaosengine/order-service:1.0.0"),
        TopologyNode(id="payment-svc", name="Payment Service", image="chaosengine/payment-service:1.0.0"),
        TopologyNode(id="notify-svc", name="Notification Service", image="chaosengine/notification-service:1.0.0"),
    ]
    # Asynchronous event feedback cycle: Order -> Payment -> Notify -> Order (via AMQP)
    edges = [
        TopologyEdge(id="e1", source="order-svc", target="payment-svc", protocol=ProtocolType.HTTP),
        TopologyEdge(id="e2", source="payment-svc", target="notify-svc", protocol=ProtocolType.HTTP),
        TopologyEdge(
            id="e3",
            source="notify-svc",
            target="order-svc",
            protocol=ProtocolType.AMQP,
            dependency_type=DependencyType.ASYNCHRONOUS,
        ),
    ]
    result = TopologyValidator.validate(nodes, edges)
    # Crucial requirement: Cycle does NOT automatically fail validation if legitimate async
    assert result.is_valid is True
    assert len(result.errors) == 0
    assert len(result.detected_cycles) == 1
    assert any(w.code == "ASYNC_EVENT_CYCLE_DETECTED" for w in result.warnings)
    assert "Asynchronous decoupling" in result.warnings[0].message


def test_validator_warns_on_synchronous_cycle():
    nodes = [
        TopologyNode(id="svc-a", name="Service A", image="chaosengine/order-service:1.0.0"),
        TopologyNode(id="svc-b", name="Service B", image="chaosengine/payment-service:1.0.0"),
    ]
    edges = [
        TopologyEdge(id="e1", source="svc-a", target="svc-b", protocol=ProtocolType.HTTP),
        TopologyEdge(id="e2", source="svc-b", target="svc-a", protocol=ProtocolType.HTTP),
    ]
    result = TopologyValidator.validate(nodes, edges)
    assert result.is_valid is True
    assert len(result.detected_cycles) == 1
    assert any(w.code == "SYNCHRONOUS_CYCLE_WARNING" for w in result.warnings)
    assert "distributed deadlock" in result.warnings[0].message
